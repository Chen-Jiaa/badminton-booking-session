import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { sessions, users, attendances, type Session, type User } from "@/db/schema";
import { eq, gte, lte, desc, and, or, count } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { rsvpSchema } from "@/lib/validations";
import { sendLateCancelRequestedNotification, sendWaitlistPromotedNotification } from "@/lib/push";
import { lockSession } from "@/lib/wallet";
import { approverTokens, promoteFromWaitlist, refundDeposit, takeDeposit } from "./roster";
import { isLateCancel } from "./rules";

type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "FORBIDDEN" }
  | { type: "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

export const fetchSessionsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    const now = new Date();
    const currentUser = session?.user.id
      ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
      : null;
    const canManageSessions = currentUser?.role === "ADMIN" || currentUser?.role === "HOST";

    const pastWhere =
      currentUser?.role === "ADMIN"
        ? lte(sessions.startTime, now)
        : currentUser?.role === "HOST"
          ? and(
              lte(sessions.startTime, now),
              or(eq(sessions.status, "LOCKED"), eq(sessions.createdById, currentUser.id)),
            )
          : and(lte(sessions.startTime, now), eq(sessions.status, "LOCKED"));

    const [upcoming, past] = await Promise.all([
      db.query.sessions.findMany({
        where: gte(sessions.startTime, now),
        orderBy: [sessions.startTime],
        with: {
          attendances: true,
          createdBy: { columns: { id: true, name: true, image: true } },
        },
      }),
      db.query.sessions.findMany({
        where: pastWhere,
        orderBy: [desc(sessions.startTime)],
        ...(canManageSessions ? {} : { limit: 20 }),
        with: {
          attendances: true,
          createdBy: { columns: { id: true, name: true, image: true } },
        },
      }),
    ]);

    return { upcoming, past };
  });

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: ["sessions"],
    queryFn: () => fetchSessionsFn(),
  });

export const fetchSessionDetailFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { id }, context: { session } }) => {
    const [gameSession, appSettings] = await Promise.all([
      db.query.sessions.findFirst({
        where: eq(sessions.id, id),
        with: {
          attendances: {
            with: {
              user: { columns: { id: true, name: true, image: true } },
            },
          },
          createdBy: { columns: { id: true, name: true, image: true, phone: true } },
        },
      }),
      db.query.settings.findFirst(),
    ]);

    if (!gameSession) return null;

    // The host's WhatsApp number is for signed-in members only, not anyone with the link
    if (!session?.user.id) gameSession.createdBy.phone = null;

    return {
      gameSession,
      groupName: appSettings?.groupName ?? "Badminton Group",
    };
  });

export const sessionDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["sessions", id],
    queryFn: () => fetchSessionDetailFn({ data: { id } }),
  });

export type RsvpOutcome =
  | "JOINED"
  | "WAITLISTED"
  | "LEFT"
  | "LEFT_WAITLIST"
  | "LATE_CANCEL_REQUESTED";

export const rsvpFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; status: "YES" | "NO" | "WAITLIST" }) => data)
  .middleware([sessionMiddleware])
  .handler(
    async ({
      data,
      context: { session },
    }): Promise<Result<{ newBalance: string; outcome: RsvpOutcome }>> => {
      if (!session?.user.id) return { type: "AUTH_ERROR" };

      const validated = rsvpSchema.parse(data);
      const userId = session.user.id;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) return { type: "AUTH_ERROR" };

      const now = new Date();
      const fail = (code: string) => ({ type: "BUSINESS_ERROR" as const, code });
      const done = (newBalance: string, outcome: RsvpOutcome) => ({
        type: "SUCCESS" as const,
        value: { newBalance, outcome },
      });

      // Everything is decided inside one transaction holding the session lock, so a
      // replayed or double-tapped request sees the result of the first one rather
      // than the same stale roster (which used to refund a deposit once per copy).
      const after: { session?: Session; lateCancel?: boolean; promoted?: User | null } = {};
      const result = await db.transaction(
        async (tx): Promise<Result<{ newBalance: string; outcome: RsvpOutcome }>> => {
          const gameSession = await lockSession(tx, validated.sessionId);
          if (!gameSession) return { type: "NOT_FOUND" };
          after.session = gameSession;
          if (gameSession.status === "LOCKED") return fail("Session is locked");

          const [existing, confirmedCount, current] = await Promise.all([
            tx.query.attendances.findFirst({
              where: and(eq(attendances.sessionId, gameSession.id), eq(attendances.userId, userId)),
            }),
            tx
              .select({ n: count() })
              .from(attendances)
              .where(and(eq(attendances.sessionId, gameSession.id), eq(attendances.status, "YES")))
              .then((r) => r[0]?.n ?? 0),
            tx.query.users.findFirst({ where: eq(users.id, userId), columns: { balance: true } }),
          ]);
          const balance = current?.balance ?? user.balance;
          const deposit = parseFloat(gameSession.minBalance);

          // ── Joining, or joining the waitlist ──
          if (validated.status === "YES" || validated.status === "WAITLIST") {
            if (gameSession.rsvpDeadline && now >= gameSession.rsvpDeadline) {
              return fail("RSVP deadline has passed");
            }
            if (now >= gameSession.startTime) {
              return fail("RSVPs are closed — the session has already started");
            }
            if (existing?.status === validated.status) {
              return done(balance, validated.status === "YES" ? "JOINED" : "WAITLISTED");
            }
            if (existing?.status === "YES") return fail("You're already in this session");
            // Both need the deposit on hand: waitlisters pay it when a spot opens up
            if (parseFloat(balance) < deposit) return fail("INSUFFICIENT_BALANCE");

            const isFull = confirmedCount >= gameSession.maxPlayers;
            if (validated.status === "YES" && isFull) {
              return fail("Session is full — join the waitlist instead");
            }
            if (validated.status === "WAITLIST" && !isFull) {
              return fail("There's a spot open — join the game instead");
            }

            let newBalance = balance;
            if (validated.status === "YES") {
              const taken = await takeDeposit(tx, {
                session: gameSession,
                userId,
                actorId: userId,
              });
              if (taken === null) return fail("INSUFFICIENT_BALANCE");
              newBalance = taken;
            }

            // A fresh RSVP starts with a clean late-cancellation record
            const fresh = {
              status: validated.status,
              waitlistedAt: validated.status === "WAITLIST" ? now : null,
              lateCancelStatus: null,
              lateCancelRequestedAt: null,
              lateCancelResolvedAt: null,
              lateCancelResolvedById: null,
              updatedAt: now,
            };
            if (existing) {
              await tx.update(attendances).set(fresh).where(eq(attendances.id, existing.id));
            } else {
              await tx.insert(attendances).values({ sessionId: gameSession.id, userId, ...fresh });
            }
            return done(newBalance, validated.status === "YES" ? "JOINED" : "WAITLISTED");
          }

          // ── Leaving ──
          if (!existing || existing.status === "NO") return done(balance, "LEFT");

          if (existing.status === "WAITLIST") {
            await tx
              .update(attendances)
              .set({ status: "NO", waitlistedAt: null, updatedAt: now })
              .where(eq(attendances.id, existing.id));
            return done(balance, "LEFT_WAITLIST");
          }

          // Inside 24h: hold the spot and ask a host/admin
          if (isLateCancel(gameSession.startTime, now)) {
            if (existing.lateCancelStatus === "PENDING")
              return done(balance, "LATE_CANCEL_REQUESTED");
            if (existing.lateCancelStatus === "REJECTED") {
              return fail("Your late cancellation was declined — you're still on for this game");
            }
            await tx
              .update(attendances)
              .set({
                lateCancelStatus: "PENDING",
                lateCancelRequestedAt: now,
                lateCancelResolvedAt: null,
                lateCancelResolvedById: null,
                updatedAt: now,
              })
              .where(eq(attendances.id, existing.id));
            after.lateCancel = true;
            return done(balance, "LATE_CANCEL_REQUESTED");
          }

          // Early enough: refund, free the spot, and hand it to the waitlist
          const refunded = await refundDeposit(tx, {
            sessionId: gameSession.id,
            userId,
            actorId: userId,
          });
          await tx
            .update(attendances)
            .set({ status: "NO", updatedAt: now })
            .where(eq(attendances.id, existing.id));
          after.promoted = await promoteFromWaitlist(tx, { session: gameSession, actorId: userId });
          return done(refunded ?? balance, "LEFT");
        },
      );

      // Notifications go out after commit, never while holding the lock
      if (after.session && after.lateCancel) {
        await sendLateCancelRequestedNotification(
          await approverTokens(after.session),
          user.name,
          after.session.id,
          after.session.startTime,
        );
      }
      if (after.session && after.promoted?.fcmToken) {
        await sendWaitlistPromotedNotification(
          after.promoted.fcmToken,
          after.session.id,
          after.session.startTime,
        );
      }

      return result;
    },
  );

/** Changed your mind about a late cancellation: keep the spot. */
export const withdrawLateCancelFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const [updated] = await db
      .update(attendances)
      .set({ lateCancelStatus: null, lateCancelRequestedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(attendances.sessionId, data.sessionId),
          eq(attendances.userId, session.user.id),
          eq(attendances.lateCancelStatus, "PENDING"),
        ),
      )
      .returning({ id: attendances.id });

    if (!updated) {
      return { type: "BUSINESS_ERROR", code: "No pending cancellation to withdraw" };
    }
    return { type: "SUCCESS", value: undefined };
  });
