// Server-only match queries. Kept out of server.ts on purpose: the browser imports
// server.ts for its query options, and the build only strips server-function
// bodies, so plain helpers that touch `db` there would drag the Postgres driver
// into the client bundle. Import these only from inside server-function handlers.
import { db } from "@/db";
import { matches, matchPlayers, users } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { isWaitingOn, type MatchView } from "./logic";

export const matchWith = {
  players: {
    with: { user: { columns: { id: true, name: true, image: true } } },
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
    })),
  };
}

/** Push subscriptions for the given users, skipping anyone without notifications on. */
export async function pushTokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.query.users.findMany({
    where: and(inArray(users.id, userIds), isNotNull(users.fcmToken)),
    columns: { fcmToken: true },
  });
  return rows.map((r) => r.fcmToken).filter((t): t is string => t !== null);
}

/** Matches waiting on this user to accept, confirm or dispute. Feeds the nav badge. */
export async function countMatchesWaitingOn(userId: string) {
  const mine = await db
    .select({ matchId: matchPlayers.matchId })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matchPlayers.userId, userId),
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
