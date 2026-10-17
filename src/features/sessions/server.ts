import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { sessions, users, attendances } from "@/db/schema";
import { eq, gte, lte, desc, and, or, count } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { rsvpSchema } from "@/lib/validations";
import { sendLateCancelRequestedNotification, sendWaitlistPromotedNotification } from "@/lib/push";
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
  .handler(async ({ data: { id } }) => {
    const [gameSession, appSettings] = await Promise.all([
      db.query.sessions.findFirst({
        where: eq(sessions.id, id),
        with: {
          attendances: {
            with: {
              user: { columns: { id: true, name: true, image: true } },
            },
          },
          createdBy: { columns: { id: true, name: true, image: true } },
        },
      }),
      db.query.settings.findFirst(),
    ]);

    if (!gameSession) return null;

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

      const [gameSession, user, existing, confirmedCount] = await Promise.all([
        db.query.sessions.findFirst({ where: eq(sessions.id, validated.sessionId) }),
        db.query.users.findFirst({ where: eq(users.id, userId) }),
        db.query.attendances.findFirst({
          where: and(
            eq(attendances.sessionId, validated.sessionId),
            eq(attendances.userId, userId),
          ),
        }),
        db
          .select({ n: count() })
          .from(attendances)
          .where(and(eq(attendances.sessionId, validated.sessionId), eq(attendances.status, "YES")))
          .then((r) => r[0]?.n ?? 0),
      ]);

      if (!gameSession) return { type: "NOT_FOUND" };
      if (!user) return { type: "AUTH_ERROR" };

      if (gameSession.status === "LOCKED") {
        return { type: "BUSINESS_ERROR", code: "Session is locked" };
      }

      const now = new Date();
      const deposit = parseFloat(gameSession.minBalance);

      // ── Joining, or joining the waitlist ──
      if (validated.status === "YES" || validated.status === "WAITLIST") {
        if (gameSession.rsvpDeadline && now >= gameSession.rsvpDeadline) {
          return { type: "BUSINESS_ERROR", code: "RSVP deadline has passed" };
        }
        if (now >= gameSession.startTime) {
          return {
            type: "BUSINESS_ERROR",
            code: "RSVPs are closed — the session has already started",
          };
        }
        if (existing?.status === validated.status) {
          return {
            type: "SUCCESS",
            value: {
              newBalance: user.balance,
              outcome: validated.status === "YES" ? "JOINED" : "WAITLISTED",
            },
          };
        }
        if (existing?.status === "YES") {
          return { type: "BUSINESS_ERROR", code: "You're already in this session" };
        }
        // Both need the deposit on hand: waitlisters pay it when a spot opens up
        if (parseFloat(user.balance) < deposit) {
          return { type: "BUSINESS_ERROR", code: "INSUFFICIENT_BALANCE" };
        }

        const isFull = confirmedCount >= gameSession.maxPlayers;
        if (validated.status === "YES" && isFull) {
          return { type: "BUSINESS_ERROR", code: "Session is full — join the waitlist instead" };
        }
        if (validated.status === "WAITLIST" && !isFull) {
          return { type: "BUSINESS_ERROR", code: "There's a spot open — join the game instead" };
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

        let newBalance = user.balance;
        await db.transaction(async (tx) => {
          if (validated.status === "YES") {
            newBalance = await takeDeposit(tx, { session: gameSession, user, actorId: userId });
          }
          if (existing) {
            await tx.update(attendances).set(fresh).where(eq(attendances.id, existing.id));
          } else {
            await tx
              .insert(attendances)
              .values({ sessionId: validated.sessionId, userId, ...fresh });
          }
        });

        return {
          type: "SUCCESS",
          value: { newBalance, outcome: validated.status === "YES" ? "JOINED" : "WAITLISTED" },
        };
      }

      // ── Leaving ──
      if (!existing || existing.status === "NO") {
        return { type: "SUCCESS", value: { newBalance: user.balance, outcome: "LEFT" } };
      }

      if (existing.status === "WAITLIST") {
        await db
          .update(attendances)
          .set({ status: "NO", waitlistedAt: null, updatedAt: now })
          .where(eq(attendances.id, existing.id));
        return { type: "SUCCESS", value: { newBalance: user.balance, outcome: "LEFT_WAITLIST" } };
      }

      // Inside 24h: hold the spot and ask a host/admin
      if (isLateCancel(gameSession.startTime, now)) {
        if (existing.lateCancelStatus === "PENDING") {
          return {
            type: "SUCCESS",
            value: { newBalance: user.balance, outcome: "LATE_CANCEL_REQUESTED" },
          };
        }
        if (existing.lateCancelStatus === "REJECTED") {
          return {
            type: "BUSINESS_ERROR",
            code: "Your late cancellation was declined — you're still on for this game",
          };
        }

        await db
          .update(attendances)
          .set({
            lateCancelStatus: "PENDING",
            lateCancelRequestedAt: now,
            lateCancelResolvedAt: null,
            lateCancelResolvedById: null,
            updatedAt: now,
          })
          .where(eq(attendances.id, existing.id));

        await sendLateCancelRequestedNotification(
          await approverTokens(gameSession),
          user.name,
          gameSession.id,
          gameSession.startTime,
        );

        return {
          type: "SUCCESS",
          value: { newBalance: user.balance, outcome: "LATE_CANCEL_REQUESTED" },
        };
      }

      // Early enough: refund, free the spot, and hand it to the waitlist
      let newBalance = user.balance;
      const promoted = await db.transaction(async (tx) => {
        newBalance =
          (await refundDeposit(tx, { sessionId: gameSession.id, userId, actorId: userId })) ??
          user.balance;
        await tx
          .update(attendances)
          .set({ status: "NO", updatedAt: now })
          .where(eq(attendances.id, existing.id));
        return promoteFromWaitlist(tx, { session: gameSession, actorId: userId });
      });

      if (promoted?.fcmToken) {
        await sendWaitlistPromotedNotification(
          promoted.fcmToken,
          gameSession.id,
          gameSession.startTime,
        );
      }

      return { type: "SUCCESS", value: { newBalance, outcome: "LEFT" } };
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
