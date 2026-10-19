import { eq } from "drizzle-orm";
import { topUpRequests } from "../src/db/schema";
import { testDb } from "./db";
import { expect, test } from "./fixtures";
import { SEED_USERS } from "./seed";

// The test server has no Supabase Storage, so these cover the checks that run before
// anything is stored. The storage side (private bucket, signed links) needs live.

const MB = 1024 * 1024;
const upload = (name: string, mimeType: string, size: number) => ({
  multipart: { file: { name, mimeType, buffer: Buffer.alloc(size) } },
});

test("upload refuses receipts over 2 MB and anything that isn't a photo", async ({ loginAs }) => {
  const page = await loginAs("player");

  const big = await page.request.post("/api/upload", upload("r.jpg", "image/jpeg", 2 * MB + 1));
  expect(big.status()).toBe(413);

  const html = await page.request.post("/api/upload", upload("r.html", "text/html", 100));
  expect(html.status()).toBe(415);
});

test("upload needs a signed-in member", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const res = await anonymous.post("/api/upload", upload("r.jpg", "image/jpeg", 100));
  expect(res.status()).toBe(401);
  await anonymous.dispose();
});

test("only admins can open a receipt", async ({ loginAs }) => {
  const { db, close } = testDb();
  const [request] = await db
    .insert(topUpRequests)
    .values({
      userId: SEED_USERS.player.id,
      amount: "50.00",
      receiptUrl: `${SEED_USERS.player.id}/1.jpg`,
    })
    .returning({ id: topUpRequests.id });
  await close();

  const player = await loginAs("player");
  const res = await player.request.get(`/api/receipts/${request.id}`, { maxRedirects: 0 });
  expect(res.status()).toBe(403);
});

test("a failed receipt upload keeps the sheet open instead of dropping the receipt", async ({
  loginAs,
}) => {
  const page = await loginAs("player");
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Top Up", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Request Top Up" });
  await dialog.getByRole("button", { name: "RM 50", exact: true }).click();
  await dialog
    .locator("#topup-receipt")
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.alloc(100) });
  // No Storage on the test server, so the upload itself fails
  await dialog.getByRole("button", { name: "Submit Top-Up Request" }).click();

  await expect(page.getByText("Couldn't upload the receipt")).toBeVisible();
  await expect(dialog).toBeVisible();
  const { db, close } = testDb();
  const rows = await db.query.topUpRequests.findMany({
    where: eq(topUpRequests.userId, SEED_USERS.player.id),
  });
  await close();
  expect(rows).toHaveLength(0);
});
