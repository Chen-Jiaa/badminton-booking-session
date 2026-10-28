// Server-only badge loading. Kept out of server.ts on purpose (see matches/queries.ts):
// plain helpers that touch `db` there would drag the Postgres driver into the browser
// bundle. Import this only from inside server-function handlers.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, matches, matchPlayers, sessions, users } from "@/db/schema";
import { BADGES, type BadgeCount, type BadgeId } from "./catalog";
import {
  computeBadgeNumbers,
  earnedByPercent,
  type BadgeMatch,
  type BadgeNumbers,
  type BadgeUser,
} from "./logic";

/** Reads the three tables badges are worked out from, and computes everyone's numbers. */
export async function loadBadgeNumbers(now = new Date()) {
  const [allUsers, attendanceRows, sessionRows, matchRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        createdAt: users.createdAt,
        isGuest: users.isGuest,
      })
      .from(users),
    db
      .select({
        userId: attendances.userId,
        sponsorId: users.sponsorId,
        sessionId: attendances.sessionId,
        status: attendances.status,
        lateCancelStatus: attendances.lateCancelStatus,
        joinedAt: attendances.createdAt,
        sessionStart: sessions.startTime,
        sessionPosted: sessions.createdAt,
        sessionStatus: sessions.status,
      })
      .from(attendances)
      .innerJoin(sessions, eq(attendances.sessionId, sessions.id))
      .innerJoin(users, eq(attendances.userId, users.id)),
    db
      .select({ id: sessions.id, startTime: sessions.startTime })
      .from(sessions)
      .where(eq(sessions.status, "LOCKED")),
    db
      .select({
        matchId: matches.id,
        format: matches.format,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        sessionStart: sessions.startTime,
        userId: matchPlayers.userId,
        side: matchPlayers.side,
        name: users.name,
        image: users.image,
        sponsorId: users.sponsorId,
      })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .innerJoin(sessions, eq(matches.sessionId, sessions.id))
      .innerJoin(users, eq(matchPlayers.userId, users.id))
      .where(eq(matches.status, "CONFIRMED"))
      .orderBy(asc(sessions.startTime), asc(matches.createdAt), asc(matches.id)),
  ]);

  // Rows arrive one per player; fold them back into matches, keeping the play order
  const matchesInOrder = new Map<string, BadgeMatch>();
  for (const r of matchRows) {
    const m = matchesInOrder.get(r.matchId) ?? {
      format: r.format,
      scoreA: r.scoreA!,
      scoreB: r.scoreB!,
      sessionStart: r.sessionStart,
      players: [],
    };
    m.players.push({
      userId: r.userId,
      name: r.name,
      image: r.image,
      side: r.side,
      sponsorId: r.sponsorId,
    });
    matchesInOrder.set(r.matchId, m);
  }

  const numbers = computeBadgeNumbers({
    users: allUsers as BadgeUser[],
    attendances: attendanceRows.map((a) => ({
      ...a,
      sessionFinalized: a.sessionStatus === "LOCKED",
    })),
    sessions: sessionRows,
    matches: Array.from(matchesInOrder.values()),
    now,
  });
  return {
    numbers,
    earnedBy: earnedByPercent(numbers),
    members: allUsers.filter((u) => !u.isGuest),
  };
}

export type BadgeData = Awaited<ReturnType<typeof loadBadgeNumbers>>;

/** The badges someone holds, rarest first (so a chip shows what's special about them). */
export function heldBadges(
  numbers: BadgeNumbers | undefined,
  earnedBy: Record<BadgeId, number>,
): BadgeCount[] {
  if (!numbers) return [];
  return BADGES.filter((b) => numbers[b.id] > 0)
    .sort((a, b) => earnedBy[a.id] - earnedBy[b.id])
    .map((b) => ({ id: b.id, count: numbers[b.id] }));
}
