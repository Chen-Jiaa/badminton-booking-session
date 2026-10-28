import { and, eq } from "drizzle-orm";
import { attendances, users } from "../src/db/schema";
import { testDb } from "./db";
import { expect, test } from "./fixtures";
import { SEED_SESSIONS, SEED_USERS } from "./seed";

// The seed has no finalized sessions, so session badges are locked. It has two confirmed
// matches at the live session (Pat scored 21 + 21 points) and every user joined in the
// app's first month, so everyone is a founding member.

test("profile shows badges with real numbers and a popup for each", async ({ loginAs }) => {
  const player = await loginAs("player");
  await player.goto("/profile");
  const shelf = player.getByRole("region", { name: "Badges" });
  await expect(shelf).toBeVisible();

  await shelf.getByRole("button", { name: /Rally Machine/ }).click();
  const popup = player.getByRole("dialog");
  await expect(popup.getByText("42", { exact: true })).toBeVisible();
  await expect(popup.getByText("points scored")).toBeVisible();
  await popup.getByRole("button", { name: "See all badges" }).click();
  await expect(popup).toBeHidden();

  await shelf.getByRole("button", { name: /Regular/ }).click();
  await expect(player.getByRole("dialog").getByText("Badge locked")).toBeVisible();
  await player.keyboard.press("Escape");

  await shelf.getByRole("button", { name: /Founding Member/ }).click();
  await expect(player.getByRole("dialog").getByText("Earned by 100% of members")).toBeVisible();
});

test("leaderboard shows a player's rarest badge under their name", async ({ loginAs }) => {
  const player = await loginAs("player");
  await player.goto("/leaderboard");
  await player.getByRole("tab", { name: "Top players" }).click();
  // Rally Machine is held by the 4 people who played, Founding Member by all 6
  await expect(player.getByText("Rally Machine").first()).toBeVisible();
});

test("someone who joined after the first month doesn't see Founding Member", async ({
  loginAs,
}) => {
  const { db, close } = testDb();
  try {
    await db
      .update(users)
      .set({ createdAt: new Date("2026-12-01T12:00:00+08:00") })
      .where(eq(users.id, SEED_USERS.player.id));
  } finally {
    await close();
  }

  const player = await loginAs("player");
  await player.goto("/profile");
  const shelf = player.getByRole("region", { name: "Badges" });
  await expect(shelf.getByRole("button", { name: /Rally Machine/ })).toBeVisible();
  await expect(shelf.getByRole("button", { name: /Founding Member/ })).toBeHidden();
  await expect(shelf.getByText("of 11", { exact: false })).toBeVisible();
});

test("rejoining after leaving counts as joining now (join time, Early Bird)", async ({
  loginAs,
}) => {
  // Pat RSVPed two days ago, then left
  const { db, close } = testDb();
  const mine = and(
    eq(attendances.sessionId, SEED_SESSIONS.upcoming),
    eq(attendances.userId, SEED_USERS.player.id),
  );
  try {
    await db.insert(attendances).values({
      sessionId: SEED_SESSIONS.upcoming,
      userId: SEED_USERS.player.id,
      status: "NO",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    const page = await loginAs("player");
    await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
    await page.getByRole("button", { name: "Join Game" }).click();
    await expect(page.getByRole("button", { name: "Leave Game" })).toBeVisible();

    const [row] = await db.select().from(attendances).where(mine);
    expect(row.status).toBe("YES");
    expect(Date.now() - row.createdAt.getTime()).toBeLessThan(60 * 1000);
  } finally {
    await close();
  }
});
