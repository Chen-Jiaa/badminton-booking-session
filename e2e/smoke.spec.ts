import { expect, test } from "./fixtures";

test("login page renders for signed-out visitors", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
});

test("signed-in player sees the seeded session", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto("/sessions");
  await expect(page.getByText("E2E Sports Hall")).toBeVisible();
});

test("signed-in player sees their wallet balance", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto("/wallet");
  await expect(page.getByText(/RM\s?50\.00/).first()).toBeVisible();
});
