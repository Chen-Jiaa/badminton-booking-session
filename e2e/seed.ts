import {
  attendances,
  courts,
  ledger,
  matches,
  matchPlayers,
  sessions,
  users,
  type NewSession,
} from "../src/db/schema";
import { testDb } from "./db";

type Db = ReturnType<typeof testDb>["db"];

export const SEED_USERS = {
  admin: { id: "e2e-admin", name: "Ada Admin", email: "admin@e2e.test", role: "ADMIN" },
  player: { id: "e2e-player", name: "Pat Player", email: "player@e2e.test", role: "PLAYER" },
  ben: { id: "e2e-ben", name: "Ben Baker", email: "ben@e2e.test", role: "PLAYER" },
  cai: { id: "e2e-cai", name: "Cai Chen", email: "cai@e2e.test", role: "PLAYER" },
  dee: { id: "e2e-dee", name: "Dee Dhillon", email: "dee@e2e.test", role: "PLAYER" },
  lou: { id: "e2e-lou", name: "Lou Lowe", email: "lou@e2e.test", role: "PLAYER" },
} as const;

export type SeedUser = keyof typeof SEED_USERS;

/** Fixed ids so tests can go straight to `/sessions/<id>`. Alphanumeric only, like real
 * cuid2 ids: the session page treats anything after a `-` as junk from a pasted link. */
export const SEED_SESSIONS = {
  /** In 3 days, 8 spots, only the admin going. For joining and leaving. */
  upcoming: "e2eupcoming",
  /** In 3 days, 2 spots, both taken (admin + Dee). For the waitlist. */
  full: "e2efull",
  /** Starts in 12 hours (inside the 24h late-cancel window). Ben is in, Cai is waitlisted. */
  late: "e2elate",
  /** Ended 2 days ago, not finalized. Pat, Ben, Cai and Dee each hold a RM 20 deposit. */
  finished: "e2efinished",
  /** Started 30 minutes ago, no deposit. Pat, Ben, Cai and Dee are in, with 2 confirmed matches. */
  live: "e2elive",
} as const;

/** Every seeded wallet shows this once the seeded deposits are taken (Lou excepted). */
export const START_BALANCE = 50;
export const LOU_BALANCE = 5;
export const DEPOSIT = 20;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Everyone joined in the app's first month, so they're all Founding Members. */
const JOINED = new Date("2026-10-20T12:00:00+08:00");

/**
 * Baseline data every test starts from (it's reset before each test). Balances are
 * what's left after the deposits below: every player except Lou has RM 50.
 */
export async function seed() {
  const { db, close } = testDb();
  try {
    await db.insert(users).values([
      { ...SEED_USERS.admin, balance: "100.00", createdAt: JOINED },
      { ...SEED_USERS.player, balance: money(START_BALANCE), createdAt: JOINED },
      { ...SEED_USERS.ben, balance: money(START_BALANCE), createdAt: JOINED },
      { ...SEED_USERS.cai, balance: money(START_BALANCE), createdAt: JOINED },
      { ...SEED_USERS.dee, balance: money(START_BALANCE), createdAt: JOINED },
      { ...SEED_USERS.lou, balance: money(LOU_BALANCE), createdAt: JOINED },
    ]);

    await db.insert(courts).values({
      name: "E2E Arena",
      mapUrl: "https://maps.google.com/?q=E2E+Arena",
    });

    const now = Date.now();
    // 8pm–10pm Malaysia time (UTC+8) three days from now, stored as UTC
    const today = new Date();
    const in3Days = (hour: number) =>
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 3, hour));

    const base = {
      courts: 2,
      costPerCourt: "30.00",
      minBalance: money(DEPOSIT),
      createdById: SEED_USERS.admin.id,
    } satisfies Partial<NewSession>;

    await db.insert(sessions).values([
      {
        ...base,
        id: SEED_SESSIONS.upcoming,
        startTime: in3Days(12),
        endTime: in3Days(14),
        location: "E2E Sports Hall",
        maxPlayers: 8,
      },
      {
        ...base,
        id: SEED_SESSIONS.full,
        startTime: in3Days(12),
        endTime: in3Days(14),
        location: "Full House Arena",
        maxPlayers: 2,
      },
      {
        ...base,
        id: SEED_SESSIONS.late,
        startTime: new Date(now + 12 * HOUR),
        endTime: new Date(now + 14 * HOUR),
        location: "Late Night Court",
        maxPlayers: 4,
      },
      {
        ...base,
        id: SEED_SESSIONS.finished,
        startTime: new Date(now - 2 * DAY),
        endTime: new Date(now - 2 * DAY + 2 * HOUR),
        costPerCourt: "40.00",
        location: "Yesterday's Hall",
        maxPlayers: 8,
      },
      {
        ...base,
        id: SEED_SESSIONS.live,
        startTime: new Date(now - 30 * 60 * 1000),
        endTime: new Date(now + 90 * 60 * 1000),
        minBalance: "0.00",
        location: "Live Hall",
        maxPlayers: 8,
      },
    ]);

    const { admin, player, ben, cai, dee } = SEED_USERS;
    await db.insert(attendances).values([
      { sessionId: SEED_SESSIONS.upcoming, userId: admin.id },
      { sessionId: SEED_SESSIONS.full, userId: admin.id },
      { sessionId: SEED_SESSIONS.full, userId: dee.id },
      { sessionId: SEED_SESSIONS.late, userId: ben.id },
      {
        sessionId: SEED_SESSIONS.late,
        userId: cai.id,
        status: "WAITLIST",
        waitlistedAt: new Date(now - HOUR),
      },
      ...[player, ben, cai, dee].flatMap((u) => [
        { sessionId: SEED_SESSIONS.finished, userId: u.id },
        { sessionId: SEED_SESSIONS.live, userId: u.id },
      ]),
    ]);

    // The deposits held, already taken off the balances above. Pat, Cai and Dee hold
    // the finished session's; Ben holds that one and the late session's.
    for (const u of [player, cai, dee]) {
      await deposit(db, SEED_SESSIONS.finished, u.id, START_BALANCE);
    }
    await deposit(db, SEED_SESSIONS.finished, ben.id, START_BALANCE + DEPOSIT);
    await deposit(db, SEED_SESSIONS.late, ben.id, START_BALANCE);

    // Two confirmed matches at the live session, so the leaderboard starts populated:
    //   Pat & Ben 21–15 Cai & Dee (doubles) · Pat 21–19 Cai (singles)
    await confirmedMatch(db, "DOUBLES", [player.id, ben.id], [cai.id, dee.id], [21, 15]);
    await confirmedMatch(db, "SINGLES", [player.id], [cai.id], [21, 19]);
  } finally {
    await close();
  }
}

function money(n: number) {
  return n.toFixed(2);
}

async function deposit(db: Db, sessionId: string, userId: string, balanceAfter: number) {
  await db.insert(ledger).values({
    userId,
    sessionId,
    type: "SESSION_DEPOSIT",
    amount: money(-DEPOSIT),
    balanceAfter: money(balanceAfter),
    note: "Session deposit",
    createdById: userId,
  });
}

async function confirmedMatch(
  db: Db,
  format: "SINGLES" | "DOUBLES",
  sideA: string[],
  sideB: string[],
  [scoreA, scoreB]: [number, number],
) {
  const now = new Date();
  const [match] = await db
    .insert(matches)
    .values({
      sessionId: SEED_SESSIONS.live,
      format,
      status: "CONFIRMED",
      scoreA,
      scoreB,
      createdById: sideA[0],
      submittedById: sideA[0],
      confirmedAt: now,
      expiresAt: now,
      updatedAt: now,
    })
    .returning();
  await db
    .insert(matchPlayers)
    .values([
      ...sideA.map((userId) => ({ matchId: match.id, userId, side: "A" as const })),
      ...sideB.map((userId) => ({ matchId: match.id, userId, side: "B" as const })),
    ]);
}
