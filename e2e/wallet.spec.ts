import { expect, expectBalance, test, type Page } from "./fixtures";
import { START_BALANCE } from "./seed";

async function requestTopUp(page: Page, amount: number) {
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Top Up", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Request Top Up" });
  await dialog.getByRole("button", { name: `RM ${amount}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Submit Top-Up Request" }).click();
  await expect(page.getByText("Top-up request submitted")).toBeVisible();
}

/** The request card on the admin's pending list for `name`. */
function pendingCard(admin: Page, name: string) {
  return admin.locator("div.bg-card", { hasText: name }).filter({ hasText: "Top-up" });
}

test("top-up request shows as pending without changing the balance", async ({ loginAs }) => {
  const page = await loginAs("player");
  await requestTopUp(page, 100);

  await expect(page.getByText("Top Up Pending")).toBeVisible();
  await expect(page.getByText("RM 100.00")).toBeVisible();
  await expectBalance(page, START_BALANCE);
});

test("admin approves a top-up and the player's balance goes up", async ({ loginAs }) => {
  const player = await loginAs("player");
  await requestTopUp(player, 100);

  const admin = await loginAs("admin");
  await admin.goto("/admin/topups");
  await expect(admin.getByText("1 awaiting review")).toBeVisible();
  const card = pendingCard(admin, "Pat Player");
  await expect(card).toContainText("RM 100.00");
  await card.getByRole("button", { name: "Confirm" }).click();
  await expect(admin.getByText("Top-up confirmed")).toBeVisible();
  await expect(admin.getByText("No pending requests")).toBeVisible();

  await expectBalance(player, START_BALANCE + 100);
  await expect(player.getByText("Top Up Success")).toBeVisible();
  await expect(player.getByText("Top Up Pending")).toBeHidden();
});

test("admin rejects a top-up with a reason the player can see", async ({ loginAs }) => {
  const player = await loginAs("player");
  await requestTopUp(player, 50);

  const admin = await loginAs("admin");
  await admin.goto("/admin/topups");
  await pendingCard(admin, "Pat Player").getByRole("button", { name: "Reject" }).click();
  const dialog = admin.getByRole("dialog", { name: "Reject Top-Up" });
  await dialog.getByPlaceholder("Reason for rejection").fill("No transfer received");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(admin.getByText("Top-up rejected")).toBeVisible();

  await expectBalance(player, START_BALANCE);
  await expect(player.getByText("Top Up Rejected")).toBeVisible();
  await expect(player.getByText("Reason: No transfer received")).toBeVisible();
});
