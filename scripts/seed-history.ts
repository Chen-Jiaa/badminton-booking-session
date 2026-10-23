// `pnpm seed:history`: adds finalized past sessions to the local test DB so the profile
// streak card has something to show. Only adds rows (safe to re-run), never deletes.
// Test DB only: reads TEST_DATABASE_URL, never DATABASE_URL. `pnpm dev:test` (without
// --no-reset) wipes it again.
import { attendances, sessions } from "../src/db/schema";
import { dayKeyOf } from "../src/features/profile/streak";
import { testDb } from "../e2e/db";
import { SEED_USERS, type SeedUser } from "../e2e/seed";

const DAY = 24 * 60 * 60 * 1000;

// Who played in each week, counted back from this week (0). Each entry is a session.
// `day` 3 = Thursday, 5 = Saturday (Monday = 0). 8pm Malaysia time.
const HISTORY: { weeksAgo: number; day: number; players: SeedUser[] }[] = [
  { weeksAgo: 0, day: 1, players: ["ben", "dee", "admin"] },
  { weeksAgo: 1, day: 3, players: ["ben", "cai", "admin"] },
  { weeksAgo: 1, day: 5, players: ["ben", "cai"] },
  { weeksAgo: 2, day: 3, players: ["ben", "cai", "admin"] },
  { weeksAgo: 3, day: 3, players: ["ben", "cai"] },
  { weeksAgo: 3, day: 5, players: ["ben"] },
  { weeksAgo: 4, day: 3, players: ["ben", "dee"] },
  { weeksAgo: 5, day: 3, players: ["ben", "dee"] },
  { weeksAgo: 6, day: 3, players: ["ben"] },
  { weeksAgo: 7, day: 3, players: ["ben"] },
  // Lou: a clean 5-week streak, one session a week
  { weeksAgo: 0, day: 0, players: ["lou"] },
  { weeksAgo: 1, day: 2, players: ["lou"] },
  { weeksAgo: 2, day: 4, players: ["lou"] },
  { weeksAgo: 3, day: 3, players: ["lou"] },
  { weeksAgo: 4, day: 1, players: ["lou"] },
];

async function main() {
  const { db, close } = testDb();
  try {
    // Monday 00:00 of this week in Malaysia time, as a UTC instant
    const todayKey = dayKeyOf(new Date());
    const [y, m, d] = todayKey.split("-").map(Number);
    const mondayOffset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const monday = Date.UTC(y, m - 1, d - mondayOffset) - 8 * 60 * 60 * 1000;

    let added = 0;
    for (const [i, h] of HISTORY.entries()) {
      const start = monday - h.weeksAgo * 7 * DAY + h.day * DAY + 20 * 60 * 60 * 1000;
      if (start > Date.now()) continue; // not played yet
      const id = `hist${i}`;
      await db
        .insert(sessions)
        .values({
          id,
          startTime: new Date(start),
          endTime: new Date(start + 2 * 60 * 60 * 1000),
          courts: 2,
          costPerCourt: "30.00",
          status: "LOCKED",
          location: "History Hall",
          createdById: SEED_USERS.admin.id,
        })
        .onConflictDoNothing();
      for (const p of h.players) {
        await db
          .insert(attendances)
          .values({ id: `${id}${p}`, sessionId: id, userId: SEED_USERS[p].id, status: "YES" })
          .onConflictDoNothing();
      }
      added++;
    }
    console.log(`Test DB: ${added} finalized sessions of history in place.`);
  } finally {
    await close();
  }
}

void main();
