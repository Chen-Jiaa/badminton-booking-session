import { and, eq } from "drizzle-orm";
import { ledger, topUpRequests, users } from "../src/db/schema";
import { testDb } from "./db";
import { expect, test, type Page } from "./fixtures";
import { DEPOSIT, SEED_SESSIONS, SEED_USERS, START_BALANCE } from "./seed";

// Money must survive someone replaying a request many times at once (a script, or a
// double tap on a slow phone). Each test lets the UI build one server-function call,
// holds it back, and fires copies of it in parallel instead.

async function fireInParallel(
  page: Page,
  trigger: () => Promise<void>,
  bodies: (body: string) => string[],
) {
  let captured: { url: string; headers: Record<string, string>; body: string } | undefined;
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || captured) return route.continue();
    captured = { url: request.url(), headers: request.headers(), body: request.postData() ?? "" };
    await route.abort();
  });
  await trigger();
  await expect.poll(() => captured).toBeTruthy();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  const { url, headers, body } = captured!;
  delete headers["content-length"];
  return Promise.all(bodies(body).map((data) => page.request.post(url, { headers, data })));
}

async function wallet(userId: string) {
  const { db, close } = testDb();
  try {
    const [user, rows] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.ledger.findMany({ where: eq(ledger.userId, userId) }),
    ]);
    const count = (type: string) => rows.filter((r) => r.type === type).length;
    return { balance: parseFloat(user!.balance), count };
  } finally {
    await close();
  }
}

test("leaving five times at once refunds the deposit once", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByRole("button", { name: "Leave Game" })).toBeVisible();

  await page.getByRole("button", { name: "Leave Game" }).click();
  await fireInParallel(
    page,
    () => page.getByRole("button", { name: "Leave", exact: true }).click(),
    (body) => Array(5).fill(body),
  );

  const after = await wallet(SEED_USERS.player.id);
  expect(after.count("SESSION_REFUND")).toBe(1);
  expect(after.balance).toBe(START_BALANCE);
});

test("joining two sessions at once takes both deposits", async ({ loginAs }) => {
  const before = await wallet(SEED_USERS.player.id);
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await fireInParallel(
    page,
    () => page.getByRole("button", { name: "Join Game" }).click(),
    (body) => [body, body.replaceAll(SEED_SESSIONS.upcoming, SEED_SESSIONS.late)],
  );

  const after = await wallet(SEED_USERS.player.id);
  expect(after.count("SESSION_DEPOSIT") - before.count("SESSION_DEPOSIT")).toBe(2);
  expect(after.balance).toBe(START_BALANCE - 2 * DEPOSIT);
});

test("confirming a top-up three times at once credits it once", async ({ loginAs }) => {
  const { db, close } = testDb();
  await db.insert(topUpRequests).values({ userId: SEED_USERS.player.id, amount: "100.00" });
  await close();

  const admin = await loginAs("admin");
  await admin.goto("/admin/topups");
  await fireInParallel(
    admin,
    () => admin.getByRole("button", { name: "Confirm" }).click(),
    (body) => Array(3).fill(body),
  );

  const after = await wallet(SEED_USERS.player.id);
  expect(after.count("TOPUP")).toBe(1);
  expect(after.balance).toBe(START_BALANCE + 100);
  const { db: db2, close: close2 } = testDb();
  const rows = await db2.query.topUpRequests.findMany({
    where: and(
      eq(topUpRequests.userId, SEED_USERS.player.id),
      eq(topUpRequests.status, "CONFIRMED"),
    ),
  });
  await close2();
  expect(rows).toHaveLength(1);
});
