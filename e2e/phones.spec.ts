import { eq } from "drizzle-orm";
import { sessions, users } from "../src/db/schema";
import { testDb } from "./db";
import { expect, test } from "./fixtures";
import { SEED_SESSIONS, SEED_USERS } from "./seed";

// Dee is in the "full" session (admin + Dee). Her number is stored as +60…, as the app saves it.
const DEE_PHONE = "+60123456789";

async function setUp(change: (db: ReturnType<typeof testDb>["db"]) => Promise<void>) {
  const { db, close } = testDb();
  try {
    await db.update(users).set({ phone: DEE_PHONE }).where(eq(users.id, SEED_USERS.dee.id));
    await change(db);
  } finally {
    await close();
  }
}

test("an admin taps a player to contact or remove them", async ({ loginAs }) => {
  await setUp(async () => {});
  const page = await loginAs("admin");
  await page.goto(`/sessions/${SEED_SESSIONS.full}`);

  await page.getByRole("button", { name: `Manage ${SEED_USERS.dee.name}` }).click();
  const dialog = page.getByRole("dialog", { name: SEED_USERS.dee.name });
  await expect(dialog.getByRole("link", { name: "Contact player" })).toHaveAttribute(
    "href",
    "https://wa.me/60123456789",
  );

  await dialog.getByRole("button", { name: "Remove player" }).click();
  await expect(page.getByRole("dialog", { name: `Remove ${SEED_USERS.dee.name}?` })).toBeVisible();
});

test("a host sees numbers only on sessions they run", async ({ loginAs }) => {
  await setUp(async (db) => {
    await db.update(users).set({ role: "HOST" }).where(eq(users.id, SEED_USERS.ben.id));
  });
  const page = await loginAs("ben");

  // Created by the admin: Ben is a host, but not this session's host
  await page.goto(`/sessions/${SEED_SESSIONS.full}`);
  expect(await page.content()).not.toContain("60123456789");

  const { db, close } = testDb();
  await db
    .update(sessions)
    .set({ createdById: SEED_USERS.ben.id })
    .where(eq(sessions.id, SEED_SESSIONS.full));
  await close();

  await page.goto(`/sessions/${SEED_SESSIONS.full}`);
  await page.getByRole("button", { name: `Manage ${SEED_USERS.dee.name}` }).click();
  await expect(
    page.getByRole("dialog", { name: SEED_USERS.dee.name }).getByRole("link", {
      name: "Contact player",
    }),
  ).toBeVisible();
});

test("a plain player never receives other players' numbers", async ({ loginAs }) => {
  await setUp(async () => {});
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.full}`);
  await expect(page.getByText(SEED_USERS.dee.name).first()).toBeVisible();
  expect(await page.content()).not.toContain("60123456789");
  await expect(page.getByRole("button", { name: /^Manage / })).toHaveCount(0);
});
