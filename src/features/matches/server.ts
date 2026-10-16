import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { attendances, matches, matchPlayers, sessions, users } from "@/db/schema";
import { loadMatch, matchWith, pushTokensFor, toView } from "./queries";
import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import type { Result } from "@/lib/guards";
import {
  createMatchSchema,
  deleteMatchSchema,
  respondToMatchSchema,
  submitMatchResultSchema,
  type CreateMatchInput,
  type DeleteMatchInput,
  type RespondToMatchInput,
  type SubmitMatchResultInput,
} from "@/lib/validations";
import {
  sendMatchConfirmedNotification,
  sendMatchDisputedNotification,
  sendMatchInviteNotification,
  sendMatchResultNotification,
} from "@/lib/push";
import {
  RECORDING_GRACE_MS,
  RESPONSE_WINDOW_MS,
  buildStandings,
  isExpired,
  isMonthKey,
  isWaitingOn,
  monthKeyOf,
  monthRange,
  otherSide,
  scoreProblem,
  sideOf,
  waitingSide,
  type MatchView,
  type Side,
} from "./logic";

const idsOnSide = (m: MatchView, side: Side) =>
  m.players.filter((p) => p.side === side).map((p) => p.userId);

/** "21–18" from the point of view of the given side. */
const scoreFor = (a: number, b: number, side: Side) => (side === "A" ? `${a}–${b}` : `${b}–${a}`);

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export const fetchSessionMatchesFn = createServerFn({ method: "GET" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data: { sessionId } }) => {
    const rows = await db.query.matches.findMany({
      where: and(eq(matches.sessionId, sessionId), ne(matches.status, "DECLINED")),
      orderBy: [asc(matches.createdAt)],
      with: matchWith,
    });
    // Newest first in the list
    return rows.map(toView).reverse();
  });

export const sessionMatchesQueryOptions = (sessionId: string) =>
  queryOptions({
    queryKey: ["matches", "session", sessionId],
    queryFn: () => fetchSessionMatchesFn({ data: { sessionId } }),
  });

export const fetchLeaderboardFn = createServerFn({ method: "GET" })
  .validator((data: { month: string }) => data)
  .handler(async ({ data }) => {
    const month = isMonthKey(data.month) ? data.month : monthKeyOf(new Date());
    const { start, end } = monthRange(month);

    // A match belongs to the month its session was played in
    const rows = await db
      .select({ id: matches.id })
      .from(matches)
      .innerJoin(sessions, eq(matches.sessionId, sessions.id))
      .where(
        and(
          eq(matches.status, "CONFIRMED"),
          gte(sessions.startTime, start),
          lt(sessions.startTime, end),
        ),
      );

    const [confirmed, earliest] = await Promise.all([
      rows.length
        ? db.query.matches.findMany({
            where: inArray(
              matches.id,
              rows.map((r) => r.id),
            ),
            orderBy: [asc(matches.createdAt)],
            with: matchWith,
          })
        : Promise.resolve([]),
      db
        .select({ startTime: sessions.startTime })
        .from(matches)
        .innerJoin(sessions, eq(matches.sessionId, sessions.id))
        .where(eq(matches.status, "CONFIRMED"))
        .orderBy(asc(sessions.startTime))
        .limit(1),
    ]);

    const standings = buildStandings(
      confirmed.map((m) => {
        const v = toView(m);
        return { format: v.format, scoreA: v.scoreA!, scoreB: v.scoreB!, players: v.players };
      }),
    );

    return {
      month,
      currentMonth: monthKeyOf(new Date()),
      // How far back the month switcher can go
      firstMonth: earliest[0] ? monthKeyOf(earliest[0].startTime) : monthKeyOf(new Date()),
      ...standings,
    };
  });

export const leaderboardQueryOptions = (month: string) =>
  queryOptions({
    queryKey: ["matches", "leaderboard", month],
    queryFn: () => fetchLeaderboardFn({ data: { month } }),
  });

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export const createMatchFn = createServerFn({ method: "POST" })
  .validator((data: CreateMatchInput) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result<{ matchId: string }>> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    const parsed = createMatchSchema.safeParse(data);
    if (!parsed.success) return { type: "BUSINESS_ERROR", code: "Check the players and score" };
    const input = parsed.data;
    const me = session.user.id;

    const sideA = input.partnerId ? [me, input.partnerId] : [me];
    const sideB = input.opponentIds;
    const everyone = [...sideA, ...sideB];
    if (new Set(everyone).size !== everyone.length) {
      return { type: "BUSINESS_ERROR", code: "A player can only be in a match once" };
    }
    if (input.score) {
      const problem = scoreProblem(input.score[0], input.score[1]);
      if (problem) return { type: "BUSINESS_ERROR", code: problem };
    }

    const [gameSession, going, recorder] = await Promise.all([
      db.query.sessions.findFirst({ where: eq(sessions.id, input.sessionId) }),
      db.query.attendances.findMany({
        where: and(
          eq(attendances.sessionId, input.sessionId),
          eq(attendances.status, "YES"),
          inArray(attendances.userId, everyone),
        ),
        columns: { userId: true },
      }),
      db.query.users.findFirst({ where: eq(users.id, me), columns: { name: true } }),
    ]);
    if (!gameSession) return { type: "NOT_FOUND" };

    const now = new Date();
    if (now < gameSession.startTime) {
      return { type: "BUSINESS_ERROR", code: "Matches can be recorded once the session starts" };
    }
    if (now.getTime() > gameSession.endTime.getTime() + RECORDING_GRACE_MS) {
      return { type: "BUSINESS_ERROR", code: "It's too late to record matches for this session" };
    }
    if (going.length !== everyone.length) {
      return { type: "BUSINESS_ERROR", code: "Everyone in the match must be at this session" };
    }

    const status = input.score ? "AWAITING_CONFIRM" : "INVITED";
    const matchId = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          sessionId: input.sessionId,
          format: input.format,
          status,
          scoreA: input.score?.[0] ?? null,
          scoreB: input.score?.[1] ?? null,
          createdById: me,
          submittedById: input.score ? me : null,
          expiresAt: new Date(now.getTime() + RESPONSE_WINDOW_MS),
          // Set from JS, not defaultNow(): the update guard compares it to a
          // millisecond Date, and Postgres' now() carries microseconds
          updatedAt: now,
        })
        .returning({ id: matches.id });
      await tx
        .insert(matchPlayers)
        .values([
          ...sideA.map((userId) => ({ matchId: match.id, userId, side: "A" as const })),
          ...sideB.map((userId) => ({ matchId: match.id, userId, side: "B" as const })),
        ]);
      return match.id;
    });

    const tokens = await pushTokensFor(sideB);
    const name = recorder?.name ?? "Someone";
    if (input.score) {
      // Opponents read it from their side: their score first
      const score = scoreFor(input.score[0], input.score[1], "B");
      await sendMatchResultNotification(tokens, name, score, input.sessionId);
    } else {
      await sendMatchInviteNotification(tokens, name, input.sessionId);
    }

    return { type: "SUCCESS", value: { matchId } };
  });

export const submitMatchResultFn = createServerFn({ method: "POST" })
  .validator((data: SubmitMatchResultInput) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    const parsed = submitMatchResultSchema.safeParse(data);
    if (!parsed.success) return { type: "BUSINESS_ERROR", code: "Enter both scores" };
    const { matchId, mode, scoreA, scoreB } = parsed.data;
    const me = session.user.id;

    const problem = scoreProblem(scoreA, scoreB);
    if (problem) return { type: "BUSINESS_ERROR", code: problem };

    const row = await loadMatch(matchId);
    if (!row) return { type: "NOT_FOUND" };
    const m = toView(row);
    const mySide = sideOf(m, me);
    if (!mySide) return { type: "FORBIDDEN" };

    if (mode === "enter") {
      if (m.status !== "IN_PLAY") {
        return { type: "BUSINESS_ERROR", code: "This match already has a result" };
      }
      const gameSession = await db.query.sessions.findFirst({
        where: eq(sessions.id, m.sessionId),
        columns: { endTime: true },
      });
      if (!gameSession) return { type: "NOT_FOUND" };
      if (Date.now() > gameSession.endTime.getTime() + RECORDING_GRACE_MS) {
        return { type: "BUSINESS_ERROR", code: "It's too late to record matches for this session" };
      }
    }
    if (mode === "dispute") {
      if (m.status !== "AWAITING_CONFIRM" || isExpired(m)) {
        return { type: "BUSINESS_ERROR", code: "This result can no longer be disputed" };
      }
      if (waitingSide(m) !== mySide) return { type: "FORBIDDEN" };
      if (m.scoreA === scoreA && m.scoreB === scoreB) {
        return { type: "BUSINESS_ERROR", code: "That's the same score. Confirm it instead" };
      }
    }

    const now = new Date();
    // Guard on the version we checked so two people can't race the same transition
    // (a dispute keeps the status, so status alone isn't enough)
    const updated = await db
      .update(matches)
      .set({
        scoreA,
        scoreB,
        previousScoreA: mode === "dispute" ? m.scoreA : null,
        previousScoreB: mode === "dispute" ? m.scoreB : null,
        status: "AWAITING_CONFIRM",
        submittedById: me,
        expiresAt: new Date(now.getTime() + RESPONSE_WINDOW_MS),
        updatedAt: now,
      })
      .where(
        and(
          eq(matches.id, matchId),
          eq(matches.status, m.status),
          eq(matches.updatedAt, m.updatedAt),
        ),
      )
      .returning({ id: matches.id });
    if (updated.length === 0) {
      return { type: "BUSINESS_ERROR", code: "Someone else just updated this match" };
    }

    const them = otherSide(mySide);
    const [tokens, user] = await Promise.all([
      pushTokensFor(idsOnSide(m, them)),
      db.query.users.findFirst({ where: eq(users.id, me), columns: { name: true } }),
    ]);
    const score = scoreFor(scoreA, scoreB, them);
    const name = user?.name ?? "Someone";
    if (mode === "dispute") await sendMatchDisputedNotification(tokens, name, score, m.sessionId);
    else await sendMatchResultNotification(tokens, name, score, m.sessionId);

    return { type: "SUCCESS", value: undefined };
  });

export const respondToMatchFn = createServerFn({ method: "POST" })
  .validator((data: RespondToMatchInput) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    const parsed = respondToMatchSchema.safeParse(data);
    if (!parsed.success) return { type: "BUSINESS_ERROR", code: "Invalid response" };
    const { matchId, action } = parsed.data;
    const me = session.user.id;

    const row = await loadMatch(matchId);
    if (!row) return { type: "NOT_FOUND" };
    const m = toView(row);

    // Only the side the match is waiting on can answer it
    if (!isWaitingOn(m, me)) {
      return isExpired(m)
        ? { type: "BUSINESS_ERROR", code: "This match has expired" }
        : { type: "FORBIDDEN" };
    }
    if (action === "accept" && m.status !== "INVITED") {
      return { type: "BUSINESS_ERROR", code: "This invite has already been answered" };
    }
    if (action === "confirm" && m.status !== "AWAITING_CONFIRM") {
      return { type: "BUSINESS_ERROR", code: "There's no result to confirm yet" };
    }

    const now = new Date();
    const next =
      action === "accept"
        ? { status: "IN_PLAY" as const }
        : action === "confirm"
          ? { status: "CONFIRMED" as const, confirmedAt: now }
          : { status: "DECLINED" as const };

    const updated = await db
      .update(matches)
      .set({ ...next, updatedAt: now })
      .where(
        and(
          eq(matches.id, matchId),
          eq(matches.status, m.status),
          eq(matches.updatedAt, m.updatedAt),
        ),
      )
      .returning({ id: matches.id });
    if (updated.length === 0) {
      return { type: "BUSINESS_ERROR", code: "Someone else just updated this match" };
    }

    // Let whoever entered the score know it now counts
    if (action === "confirm" && m.submittedById && m.scoreA !== null && m.scoreB !== null) {
      const submitterSide = sideOf(m, m.submittedById)!;
      const [tokens, user] = await Promise.all([
        pushTokensFor([m.submittedById]),
        db.query.users.findFirst({ where: eq(users.id, me), columns: { name: true } }),
      ]);
      await sendMatchConfirmedNotification(
        tokens,
        user?.name ?? "Someone",
        scoreFor(m.scoreA, m.scoreB, submitterSide),
        m.sessionId,
      );
    }

    return { type: "SUCCESS", value: undefined };
  });

export const deleteMatchFn = createServerFn({ method: "POST" })
  .validator((data: DeleteMatchInput) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    const parsed = deleteMatchSchema.safeParse(data);
    if (!parsed.success) return { type: "BUSINESS_ERROR", code: "Invalid match" };
    const { matchId } = parsed.data;

    const row = await loadMatch(matchId);
    if (!row) return { type: "NOT_FOUND" };
    const m = toView(row);
    if (!sideOf(m, session.user.id)) return { type: "FORBIDDEN" };
    // Only an accepted match that never got a score can go: anything with a result
    // has to be confirmed or disputed instead
    if (m.status !== "IN_PLAY") {
      return { type: "BUSINESS_ERROR", code: "Only a match without a score can be deleted" };
    }

    // match_players rows go with their match (ON DELETE CASCADE). Guarded like the
    // other transitions, so a score entered at the same moment wins.
    const deleted = await db
      .delete(matches)
      .where(
        and(
          eq(matches.id, matchId),
          eq(matches.status, m.status),
          eq(matches.updatedAt, m.updatedAt),
        ),
      )
      .returning({ id: matches.id });
    if (deleted.length === 0) {
      return { type: "BUSINESS_ERROR", code: "Someone else just updated this match" };
    }

    return { type: "SUCCESS", value: undefined };
  });
