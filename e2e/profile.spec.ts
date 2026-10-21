import { expect, test } from "./fixtures";
import { SEED_USERS } from "./seed";

test("member renames themselves and the new name sticks", async ({ loginAs }) => {
  const player = await loginAs("player");
  await player.goto("/profile");
  await expect(player.getByRole("heading", { name: SEED_USERS.player.name })).toBeVisible();

  await player.getByRole("button", { name: "Edit name" }).click();
  const input = player.getByLabel("Your name");
  const save = player.locator("form").filter({ has: input }).getByRole("button", { name: "Save" });
  await input.fill("   ");
  await expect(save).toBeDisabled();

  await input.fill("Pat Smasher");
  await save.click();
  await expect(player.getByText("Name updated")).toBeVisible();
  await expect(player.getByRole("heading", { name: "Pat Smasher" })).toBeVisible();

  await player.reload();
  await expect(player.getByRole("heading", { name: "Pat Smasher" })).toBeVisible();
});

test("a Google sign-in sync keeps a photo the member uploaded", async () => {
  const { isCustomAvatar } = await import("../src/features/profile/avatar");
  expect(isCustomAvatar("https://x.supabase.co/storage/v1/object/public/avatars/u1/1.jpg")).toBe(
    true,
  );
  expect(isCustomAvatar("https://lh3.googleusercontent.com/a/abc")).toBe(false);
  expect(isCustomAvatar(null)).toBe(false);
});
