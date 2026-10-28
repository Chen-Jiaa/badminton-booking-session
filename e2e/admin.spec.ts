import { expect, expectBalance, test } from "./fixtures";
import { DEPOSIT, SEED_SESSIONS, START_BALANCE } from "./seed";

test("host saves a WhatsApp number that players can tap", async ({ loginAs }) => {
  const admin = await loginAs("admin");
  await admin.goto("/profile");
  await admin.getByRole("button", { name: "Edit WhatsApp number" }).click();
  const phone = admin.getByPlaceholder("012-345 6789");
  const save = admin.getByRole("button", { name: "Save", exact: true });

  await phone.fill("12345");
  await save.click();
  await expect(admin.getByText("Enter a valid phone number")).toBeVisible();

  await phone.fill("012-345 6789");
  await save.click();
  await expect(admin.getByText("WhatsApp number saved")).toBeVisible();
  await expect(admin.getByText("+60123456789")).toBeVisible();

  const player = await loginAs("player");
  await player.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await expect(player.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/60123456789",
  );
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

test("admin session actions live behind the ⋯ menu", async ({ loginAs }) => {
  const admin = await loginAs("admin");
  await admin.goto(`/admin/sessions/${SEED_SESSIONS.upcoming}`);
  const more = admin.getByRole("button", { name: "More actions" });

  await expect(admin.getByRole("button", { name: "Edit" })).toBeVisible();

  // Backing out of Delete leaves the page usable
  await more.click();
  await admin.getByRole("menuitem", { name: "Delete session" }).click();
  const confirm = admin.getByRole("dialog", { name: "Delete Session" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await admin.getByRole("button", { name: "Edit" }).click();
  await expect(admin.getByRole("dialog", { name: "Edit Session" })).toBeVisible();
  await admin.keyboard.press("Escape");

  await more.click();
  await admin.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(admin).toHaveURL(new RegExp(`/admin/sessions/new\\?from=${SEED_SESSIONS.upcoming}`));

  await admin.goto(`/admin/sessions/${SEED_SESSIONS.upcoming}`);
  await more.click();
  await admin.getByRole("menuitem", { name: "Delete session" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(admin).toHaveURL(/\/admin\/sessions$/);
});
