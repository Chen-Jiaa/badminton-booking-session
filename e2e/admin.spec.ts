import { expect, expectBalance, test } from "./fixtures";
import { DEPOSIT, SEED_SESSIONS, START_BALANCE } from "./seed";

test("host saves a WhatsApp number that players can tap", async ({ loginAs }) => {
  const admin = await loginAs("admin");
  await admin.goto("/profile");
  const phone = admin.getByPlaceholder("012-345 6789");
  const save = admin.getByRole("button", { name: "Save", exact: true });

  await phone.fill("12345");
  await save.click();
  await expect(admin.getByText("Enter a valid phone number")).toBeVisible();

  await phone.fill("012-345 6789");
  await save.click();
  await expect(admin.getByText("WhatsApp number saved")).toBeVisible();
  await expect(phone).toHaveValue("+60123456789");

  const player = await loginAs("player");
  await player.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await expect(player.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/60123456789",
  );
});

test("players don't get the WhatsApp number field", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await expect(page.getByText("WhatsApp number")).toBeHidden();
});

test("admin creates a session that players can see", async ({ loginAs }) => {
  const admin = await loginAs("admin");
  await admin.goto("/admin/sessions/new");

  // Prefilled from the admin's latest session, a week on
  await expect(admin.getByText("Copied from")).toBeVisible();
  await admin.getByRole("combobox").click();
  await admin.getByText("E2E Arena", { exact: true }).click();
  await admin.getByLabel("Court Numbers").fill("7 & 8");
  await admin.getByLabel("Max Players").fill("12");
  await admin.getByLabel("Note (optional)").fill("Bring a towel");
  await admin.getByRole("button", { name: "Create Session" }).click();

  const shared = admin.getByRole("dialog", { name: "Session created!" });
  await expect(shared).toBeVisible();
  const url = await shared.getByRole("textbox").inputValue();
  expect(url).toMatch(/\/sessions\/[a-z0-9]+$/);

  const player = await loginAs("player");
  await player.goto("/sessions");
  await expect(player.getByText("E2E Arena")).toBeVisible();

  await player.goto(new URL(url).pathname);
  await expect(player.getByText("Court: 7 & 8")).toBeVisible();
  await expect(player.getByText("Bring a towel")).toBeVisible();
  await expect(player.getByRole("button", { name: "Join Game" })).toBeVisible();
});

test("finalizing a session charges each player their share", async ({ loginAs }) => {
  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.finished}`);
  await expect(admin.getByText("Finalize Session", { exact: true })).toBeVisible();

  // 2 courts × RM 40 + RM 12 shuttles = RM 92, split 4 ways = RM 23 each
  await admin.getByLabel("Shuttles Used").fill("3");
  await admin.getByLabel("Total Shuttle Cost (RM)").fill("12");
  await expect(admin.getByText("Per player (4 players)")).toBeVisible();
  await admin.getByRole("button", { name: "Finalize Session & Deduct from Balances" }).click();

  const confirm = admin.getByRole("dialog", { name: "Charge 4 players RM 23.00 each?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Charge RM 23.00 each" }).click();
  await expect(admin.getByText("Session finalized and costs deducted")).toBeVisible();
  await expect(admin.getByText("Game Locked")).toBeVisible();

  // The RM 20 deposit already held covers most of it; the other RM 3 comes off the wallet
  const player = await loginAs("player");
  await expectBalance(player, START_BALANCE - (23 - DEPOSIT));
  await expect(player.getByText("Session Fee", { exact: true })).toBeVisible();
});
