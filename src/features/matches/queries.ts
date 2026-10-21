// Server-only match queries. Kept out of server.ts on purpose: the browser imports
// server.ts for its query options, and the build only strips server-function
// bodies, so plain helpers that touch `db` there would drag the Postgres driver
// into the client bundle. Import these only from inside server-function handlers.
import { db } from "@/db";
import { matches, matchPlayers, users } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { isWaitingOn, type MatchView } from "./logic";

export const matchWith = {
  players: {
    with: { user: { columns: { id: true, name: true, image: true, sponsorId: true } } },
  },
} as const;

export type MatchRow = Awaited<ReturnType<typeof loadMatch>>;

export function loadMatch(id: string) {
  return db.query.matches.findFirst({ where: eq(matches.id, id), with: matchWith });
}

export function toView(m: NonNullable<MatchRow>): MatchView {
  return {
    id: m.id,
    sessionId: m.sessionId,
    format: m.format,
    status: m.status,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    previousScoreA: m.previousScoreA,
    previousScoreB: m.previousScoreB,
    createdById: m.createdById,
    submittedById: m.submittedById,
    expiresAt: m.expiresAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    players: m.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      image: p.user.image,
      side: p.side,
      sponsorId: p.user.sponsorId,
    })),
  };
}

/**
 * Push subscriptions for the given users, skipping anyone without notifications on.
 * A guest has no phone, so their sponsor is notified in their place.
 */
export async function pushTokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const people = await db.query.users.findMany({
    where: inArray(users.id, userIds),
    columns: { fcmToken: true, sponsorId: true },
  });
  const sponsorIds = people.flatMap((p) => (p.sponsorId ? [p.sponsorId] : []));
  const sponsors = sponsorIds.length
    ? await db.query.users.findMany({
        where: and(inArray(users.id, sponsorIds), isNotNull(users.fcmToken)),
        columns: { fcmToken: true },
      })
    : [];
  const tokens = [...people.filter((p) => !p.sponsorId), ...sponsors].map((r) => r.fcmToken);
  return Array.from(new Set(tokens.filter((t): t is string => t !== null)));
}

/** Matches waiting on this user to accept, confirm or dispute. Feeds the nav badge. */
export async function countMatchesWaitingOn(userId: string) {
  const mine = await db
    .select({ matchId: matchPlayers.matchId })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .innerJoin(users, eq(matchPlayers.userId, users.id))
    .where(
      and(
        // Your guests' matches wait on you too
        or(eq(matchPlayers.userId, userId), eq(users.sponsorId, userId)),
        inArray(matches.status, ["INVITED", "AWAITING_CONFIRM"]),
        gte(matches.expiresAt, new Date()),
      ),
    );
  if (mine.length === 0) return { count: 0, sessionId: null };

  const pending = await db.query.matches.findMany({
    where: inArray(
      matches.id,
      mine.map((m) => m.matchId),
    ),
    with: matchWith,
  });
  const waiting = pending.map(toView).filter((m) => isWaitingOn(m, userId));
  return { count: waiting.length, sessionId: waiting[0]?.sessionId ?? null };
}
