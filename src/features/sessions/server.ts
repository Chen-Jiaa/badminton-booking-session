import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { sessions, users, attendances, ledger } from "@/db/schema";
import { eq, gte, lte, desc, and, or, inArray } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { rsvpSchema } from "@/lib/validations";

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

export const rsvpFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; status: "YES" | "NO" | "WAITLIST" }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result<{ newBalance: string }>> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = rsvpSchema.parse(data);
    const userId = session.user.id;

    const [gameSession, user, existing, depositLedger] = await Promise.all([
      db.query.sessions.findFirst({ where: eq(sessions.id, validated.sessionId) }),
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.attendances.findFirst({
        where: and(eq(attendances.sessionId, validated.sessionId), eq(attendances.userId, userId)),
      }),
      db.query.ledger.findMany({
        where: and(
          eq(ledger.sessionId, validated.sessionId),
          eq(ledger.userId, userId),
          inArray(ledger.type, ["SESSION_DEPOSIT", "SESSION_REFUND"]),
        ),
      }),
    ]);

    if (!gameSession) return { type: "NOT_FOUND" };
    if (!user) return { type: "AUTH_ERROR" };

    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Session is locked" };
    }

    if (validated.status === "YES" || validated.status === "WAITLIST") {
      const now = new Date();
      if (gameSession.rsvpDeadline && now >= gameSession.rsvpDeadline) {
        return { type: "BUSINESS_ERROR", code: "RSVP deadline has passed" };
      }
      if (now >= gameSession.startTime) {
        return {
          type: "BUSINESS_ERROR",
          code: "RSVPs are closed — the session has already started",
        };
      }
    }

    const deposit = parseFloat(gameSession.minBalance);
    // What the player is actually holding for this session — the net of their
    // deposit/refund ledger rows. Refunds are driven off this, not the current
    // minBalance, so an admin editing minBalance after they joined can't change
    // what's returned.
    const heldDeposit = -depositLedger.reduce((total, e) => total + parseFloat(e.amount), 0);
    let newBalance = user.balance;

    if (validated.status === "YES") {
      const balance = parseFloat(user.balance);
      if (balance < deposit) {
        return { type: "BUSINESS_ERROR", code: "INSUFFICIENT_BALANCE" };
      }

      await db.transaction(async (tx) => {
        newBalance = (parseFloat(user.balance) - deposit).toFixed(2);
        await tx
          .update(users)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await tx.insert(ledger).values({
          userId,
          type: "SESSION_DEPOSIT",
          amount: (-deposit).toFixed(2),
          balanceAfter: newBalance,
          note: "Session deposit",
          createdById: userId,
          sessionId: validated.sessionId,
        });

        if (existing) {
          await tx
            .update(attendances)
            .set({ status: "YES", updatedAt: new Date() })
            .where(eq(attendances.id, existing.id));
        } else {
          await tx
            .insert(attendances)
            .values({ sessionId: validated.sessionId, userId, status: "YES" });
        }
      });
    } else {
      // Leaving — refund whatever deposit they're actually holding
      if (existing && heldDeposit > 0) {
        await db.transaction(async (tx) => {
          newBalance = (parseFloat(user.balance) + heldDeposit).toFixed(2);
          await tx
            .update(users)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(users.id, userId));

          await tx.insert(ledger).values({
            userId,
            type: "SESSION_REFUND",
            amount: heldDeposit.toFixed(2),
            balanceAfter: newBalance,
            note: "Deposit refund",
            createdById: userId,
            sessionId: validated.sessionId,
          });

          await tx
            .update(attendances)
            .set({ status: "NO", updatedAt: new Date() })
            .where(eq(attendances.id, existing.id));
        });
      } else if (existing) {
        await db
          .update(attendances)
          .set({ status: "NO", updatedAt: new Date() })
          .where(eq(attendances.id, existing.id));
      }
    }

    return { type: "SUCCESS", value: { newBalance } };
  });
