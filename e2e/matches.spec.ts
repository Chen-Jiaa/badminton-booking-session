import { expect, test, type Page } from "./fixtures";
import { SEED_SESSIONS } from "./seed";

/** Pat records Pat & Ben 21–15 Cai & Dee at the live session. */
async function recordDoubles(page: Page) {
  await page.goto(`/sessions/${SEED_SESSIONS.live}`);
  await page.getByRole("button", { name: "Record match" }).click();

  const court = page.getByRole("dialog", { name: "Record match" });
  // Each bench tap fills the next empty slot: partner, then the two opponents
  for (const name of ["Ben Baker", "Cai Chen", "Dee Dhillon"]) {
    await court.getByRole("button", { name }).click();
  }
  await court.getByRole("button", { name: "Type score for your side" }).click();
  await court.getByLabel("Score for your side").fill("21");
  // Two digits hops straight to the other side's score
  await court.getByLabel("Score for opponents").fill("15");

  await court.getByRole("button", { name: "Send 21–15 to Cai Chen & Dee Dhillon" }).click();
  await expect(page.getByText("Sent for confirmation")).toBeVisible();
}

test("player records a match and an opponent confirms it", async ({ loginAs }) => {
  const pat = await loginAs("player");
  await recordDoubles(pat);
  await expect(pat.getByText("Awaiting confirmation")).toBeVisible();
  await expect(pat.getByText("Waiting for Cai Chen & Dee Dhillon")).toBeVisible();

  const cai = await loginAs("cai");
  await cai.goto(`/sessions/${SEED_SESSIONS.live}`);
  await expect(cai.getByText("1 match is waiting for you")).toBeVisible();
  await expect(cai.getByText("Pat Player recorded this result")).toBeVisible();
  await cai.getByRole("button", { name: "Confirm" }).click();
  await expect(cai.getByText("1 match is waiting for you")).toBeHidden();
  await expect(cai.getByText("Awaiting confirmation")).toBeHidden();

  // Seeded: Pat won both earlier matches, so this makes it 3–0 for the night
  await pat.reload();
  await expect(pat.getByText("Awaiting confirmation")).toBeHidden();
  await expect(pat.getByText("3W")).toBeVisible();
});

test("confirmed matches rank players on the monthly leaderboard", async ({ loginAs }) => {
  const pat = await loginAs("player");
  await pat.goto("/leaderboard");
  // Attendance is the first tab; the match standings are on Top players
  await pat.getByRole("tab", { name: "Top players" }).click();
  // Two seeded matches already rank everyone: one confirmed match is enough
  await expect(pat.getByText("No rankings yet")).toBeHidden();
  await expect(pat.locator(".rise-in.grid")).toHaveCount(4);

  await recordDoubles(pat);
  const cai = await loginAs("cai");
  await cai.goto(`/sessions/${SEED_SESSIONS.live}`);
  await cai.getByRole("button", { name: "Confirm" }).click();
  await expect(cai.getByText("1 match is waiting for you")).toBeHidden();

  // Pat: 21 + 21 + 21 = 63 points, 3–0 · Cai: 15 + 19 + 15 = 49 points, 0–3
  await pat.goto("/leaderboard");
  await pat.getByRole("tab", { name: "Top players" }).click();
  const myCard = pat.getByText("your rank").locator("xpath=ancestor::div[2]");
  await expect(myCard).toContainText("#1");
  await expect(myCard).toContainText("63");
  await expect(myCard).toContainText("3–0");

  const rows = pat.locator(".rise-in.grid");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("You");
  await expect(rows.nth(0)).toContainText("63");

  // Pat & Ben have won twice together: top team
  await pat.getByRole("tab", { name: "Top teams" }).click();
  await expect(pat.getByText("No rankings yet")).toBeHidden();
  await expect(pat.locator(".rise-in.grid").nth(0)).toContainText("Ben Baker");
});
