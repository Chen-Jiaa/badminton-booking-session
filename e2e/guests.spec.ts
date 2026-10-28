import { eq } from "drizzle-orm";
import { attendances, ledger, matchPlayers, matches, sessions, users } from "../src/db/schema";
import { testDb } from "./db";
import { expect, expectBalance, test, type Page } from "./fixtures";
import { DEPOSIT, LOU_BALANCE, SEED_SESSIONS, SEED_USERS, START_BALANCE } from "./seed";

const SHEET = /Who.s coming with you\?/;

/** Opens "Bring a friend", adds the names, and saves. */
async function bringFriends(page: Page, ...names: string[]) {
  await page.getByRole("button", { name: "Bring a friend" }).click();
  const sheet = page.getByRole("dialog", { name: SHEET });
  for (const name of names) {
    await sheet.getByLabel("New friend's name").fill(name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
  }
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Guests saved")).toBeVisible();
  await expect(sheet).toBeHidden();
}

test("a member brings a friend and pays the friend's deposit", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByRole("button", { name: "Leave Game" })).toBeVisible();

  await bringFriends(page, "Wei Jie");
  await expect(page.getByText("· 3/8")).toBeVisible();
  await expect(page.getByText("Wei Jie").first()).toBeVisible();
  await expect(page.getByText("Pat's guest", { exact: true })).toBeVisible();

  // Pat's own deposit plus the friend's, both from Pat's wallet
  await expectBalance(page, START_BALANCE - 2 * DEPOSIT);
  await expect(page.getByText("Session Deposit").first()).toBeVisible();
});

test("a member who leaves can still remove their guest and get the deposit back", async ({
  loginAs,
}) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await bringFriends(page, "Wei Jie");

  await page.getByRole("button", { name: "Leave Game" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();

  // The guest stays, and the sponsor is told they still pay for them
  await expect(page.getByText(/your guest stays/)).toBeVisible();
  await expectBalance(page, START_BALANCE - DEPOSIT);

  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Manage" }).click();
  const sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByRole("button", { name: "Remove Wei Jie" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Guests saved")).toBeVisible();

  await expectBalance(page, START_BALANCE);
});

test("a friend costs a deposit too: short wallets are asked to top up", async ({ loginAs }) => {
  const page = await loginAs("lou");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Bring a friend" }).click();
  const sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByLabel("New friend's name").fill("Priya");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    sheet.getByRole("button", {
      name: `Top up RM ${(DEPOSIT - LOU_BALANCE).toFixed(2)} to continue`,
    }),
  ).toBeVisible();
});

test("a friend beyond the last seat joins the waitlist", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.full}`);
  await bringFriends(page, "Kenji");

  await expect(page.getByText("Waitlist", { exact: true }).first()).toBeVisible();
  // Waitlisting doesn't take the deposit yet
  await expectBalance(page, START_BALANCE);
});

test("finalizing charges the sponsor for the guest's share too", async ({ loginAs }) => {
  // The session already ended, so seat a guest straight in the database
  const { db, close } = testDb();
  try {
    const [guest] = await db
      .insert(users)
      .values({ name: "Wei Jie", isGuest: true, sponsorId: SEED_USERS.player.id })
      .returning();
    await db.insert(attendances).values({
      sessionId: SEED_SESSIONS.finished,
      userId: guest.id,
      status: "YES",
    });
    const balance = START_BALANCE - DEPOSIT;
    await db
      .update(users)
      .set({ balance: balance.toFixed(2) })
      .where(eq(users.id, SEED_USERS.player.id));
    await db.insert(ledger).values({
      userId: SEED_USERS.player.id,
      guestId: guest.id,
      type: "SESSION_DEPOSIT",
      amount: (-DEPOSIT).toFixed(2),
      balanceAfter: balance.toFixed(2),
      note: "Session deposit (guest Wei Jie)",
      createdById: SEED_USERS.player.id,
      sessionId: SEED_SESSIONS.finished,
    });
  } finally {
    await close();
  }

  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.finished}`);
  // 2 courts × RM 40 + RM 12 shuttles = RM 92, split 5 ways = RM 18.40 each
  await admin.getByLabel("Shuttles Used").fill("3");
  await admin.getByLabel("Total Shuttle Cost (RM)").fill("12");
  await expect(admin.getByText("Per player (5 players)")).toBeVisible();
  await admin.getByRole("button", { name: "Finalize Session & Deduct from Balances" }).click();
  const confirm = admin.getByRole("dialog", { name: "Charge 5 players RM 18.40 each?" });
  await confirm.getByRole("button", { name: "Charge RM 18.40 each" }).click();
  await expect(admin.getByText("Game Locked")).toBeVisible();

  // Both Pat's and the guest's RM 20 deposits come back less RM 18.40: RM 1.60 each
  const player = await loginAs("player");
  await expectBalance(player, START_BALANCE - DEPOSIT + 2 * (DEPOSIT - 18.4));
});

test("guests never show up in the member list", async ({ loginAs }) => {
  const player = await loginAs("player");
  await player.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await bringFriends(player, "Wei Jie");

  const admin = await loginAs("admin");
  await admin.goto("/admin/members");
  // Pat shows up (the list has loaded), the guest does not
  await expect(admin.locator("body")).toContainText("Pat Player");
  await expect(admin.locator("body")).not.toContainText("Wei Jie");
});

/** Pat's 21–10 result waiting on `opponent`: a seeded guest of Pat's, or Ben. */
async function pendingMatch(opponent: "own guest" | "ben") {
  const { db, close } = testDb();
  try {
    let opponentId: string = SEED_USERS.ben.id;
    if (opponent === "own guest") {
      const [guest] = await db
        .insert(users)
        .values({ name: "Wei Jie", isGuest: true, sponsorId: SEED_USERS.player.id })
        .returning();
      await db
        .insert(attendances)
        .values({ sessionId: SEED_SESSIONS.live, userId: guest.id, status: "YES" });
      opponentId = guest.id;
    }
    const now = new Date();
    const [match] = await db
      .insert(matches)
      .values({
        sessionId: SEED_SESSIONS.live,
        format: "SINGLES",
        status: "AWAITING_CONFIRM",
        scoreA: 21,
        scoreB: 10,
        createdById: SEED_USERS.player.id,
        submittedById: SEED_USERS.player.id,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        updatedAt: now,
      })
      .returning();
    await db.insert(matchPlayers).values([
      { matchId: match.id, userId: SEED_USERS.player.id, side: "A" },
      { matchId: match.id, userId: opponentId, side: "B" },
    ]);
  } finally {
    await close();
  }
}

test("singles against your own guest: only the host or an admin can confirm it", async ({
  loginAs,
}) => {
  await pendingMatch("own guest");

  // Pat can't confirm their own result for their guest
  const pat = await loginAs("player");
  await pat.goto(`/sessions/${SEED_SESSIONS.live}`);
  await expect(pat.getByText("Awaiting confirmation")).toBeVisible();
  await expect(pat.getByRole("button", { name: "Confirm" })).toBeHidden();

  // Nor can another player
  const ben = await loginAs("ben");
  await ben.goto(`/sessions/${SEED_SESSIONS.live}`);
  await expect(ben.getByText("Awaiting confirmation")).toBeVisible();
  await expect(ben.getByRole("button", { name: "Confirm" })).toBeHidden();

  // The session's host (the admin) can
  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.live}`);
  await expect(admin.getByText("1 match is waiting for you")).toBeVisible();
  await admin.getByRole("button", { name: "Confirm" }).click();
  await expect(admin.getByText("Awaiting confirmation")).toBeHidden();

  // Seeded Pat is 2–0, so the confirmed win makes it 3–0
  await pat.reload();
  await expect(pat.getByText("3W")).toBeVisible();
});

test("a normal match is still confirmed by the opponent, never the admin", async ({ loginAs }) => {
  await pendingMatch("ben");

  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.live}`);
  await expect(admin.getByText("Awaiting confirmation")).toBeVisible();
  await expect(admin.getByRole("button", { name: "Confirm" })).toBeHidden();

  const ben = await loginAs("ben");
  await ben.goto(`/sessions/${SEED_SESSIONS.live}`);
  await ben.getByRole("button", { name: "Confirm" }).click();
  await expect(ben.getByText("Awaiting confirmation")).toBeHidden();
});

test("a friend who turns up after the start can take a free seat", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.live}`);

  await bringFriends(page, "Late Larry");
  await expect(page.getByText("Late Larry").first()).toBeVisible();
});

test("a late friend is refused when the game filled up meanwhile", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.live}`);
  await page.getByRole("button", { name: "Bring a friend" }).click();

  // The last seat goes while the sheet is open
  const { db, close } = testDb();
  await db.update(sessions).set({ maxPlayers: 4 }).where(eq(sessions.id, SEED_SESSIONS.live));
  await close();

  const sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByLabel("New friend's name").fill("Late Larry");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("no free spots")).toBeVisible();
  await expect(page.getByText("Guests saved")).toBeHidden();
});

test("a member can delete a friend from their 'Brought before' list", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await bringFriends(page, "Wei Jie");

  // Take the friend off the game, then they show up under "Brought before"
  await page.getByRole("button", { name: "Manage" }).click();
  let sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByRole("button", { name: "Remove Wei Jie" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Guests saved")).toBeVisible();

  await page.getByRole("button", { name: "Bring a friend" }).click();
  sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByRole("button", { name: "Delete Wei Jie from your list" }).click();
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Wei Jie deleted from your list")).toBeVisible();
  await expect(sheet.getByText("Brought before")).toBeHidden();

  // Their history row is kept, only hidden from the list
  const { db, close } = testDb();
  try {
    const [row] = await db.select().from(users).where(eq(users.name, "Wei Jie"));
    expect(row.archivedAt).not.toBeNull();
  } finally {
    await close();
  }
});

test("a friend who only played finished games can be deleted", async ({ loginAs }) => {
  const { db, close } = testDb();
  try {
    const [guest] = await db
      .insert(users)
      .values({ name: "Wei Jie", isGuest: true, sponsorId: SEED_USERS.player.id })
      .returning();
    await db
      .insert(attendances)
      .values({ sessionId: SEED_SESSIONS.finished, userId: guest.id, status: "YES" });
  } finally {
    await close();
  }

  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Bring a friend" }).click();
  const sheet = page.getByRole("dialog", { name: SHEET });
  await sheet.getByRole("button", { name: "Delete Wei Jie from your list" }).click();
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Wei Jie deleted from your list")).toBeVisible();
});
