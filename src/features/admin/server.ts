import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import {
  courts,
  sessions,
  attendances,
  users,
  ledger,
  topUpRequests,
  withdrawalRequests,
} from "@/db/schema";
import { eq, lte, desc, and, notInArray, sum } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import {
  createSessionSchema,
  updateSessionSchema,
  lockSessionSchema,
  addPlayerSchema,
  rejectTopUpSchema,
} from "@/lib/validations";
import {
  sendLowBalanceNotification,
  sendTopUpConfirmedNotification,
  sendTopUpRejectedNotification,
} from "@/lib/fcm";

type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "FORBIDDEN" }
  | { type: "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

// ─── Courts ──────────────────────────────────────────────────────────────────

const PREDEFINED_COURTS = [
  "https://maps.app.goo.gl/vY5VbPZhLXwvCYru5",
  "https://maps.app.goo.gl/Vib8GgxLakwqzVxk7",
  "https://maps.app.goo.gl/U54Him1k9piY6SUv8",
  "https://maps.app.goo.gl/5zD8q2hhHk8DDcnJ6",
  "https://maps.app.goo.gl/TBmMPJGggs7bFXX88",
  "https://maps.app.goo.gl/j5LVWxuNdzDw4FKYA",
];

async function resolveMapUrlName(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const match = res.url.match(/maps\/place\/([^/@?]+)/);
    if (match) return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    // fall through
  }
  return url;
}

export const fetchCourtsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    const allCourts = await db.query.courts.findMany({
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });

    if (allCourts.length === 0) {
      const resolved = await Promise.all(
        PREDEFINED_COURTS.map(async (url) => ({
          name: await resolveMapUrlName(url),
          mapUrl: url,
        })),
      );
      return db.insert(courts).values(resolved).returning();
    }

    return allCourts;
  });

export const courtsQueryOptions = () =>
  queryOptions({
    queryKey: ["courts"],
    queryFn: () => fetchCourtsFn(),
  });

export const createCourtFn = createServerFn({ method: "POST" })
  .validator((data: { mapUrl: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result<typeof courts.$inferSelect>> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    const name = await resolveMapUrlName(data.mapUrl);
    const [court] = await db.insert(courts).values({ name, mapUrl: data.mapUrl }).returning();
    return { type: "SUCCESS", value: court };
  });

export const deleteCourtFn = createServerFn({ method: "POST" })
  .validator((data: { courtId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    await db.delete(courts).where(eq(courts.id, data.courtId));
    return { type: "SUCCESS", value: undefined };
  });

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const fetchAdminSessionsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return [];

    return db.query.sessions.findMany({
      orderBy: [desc(sessions.startTime)],
      with: { attendances: true },
    });
  });

export const adminSessionsQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "sessions"],
    queryFn: () => fetchAdminSessionsFn(),
  });

export const fetchAdminSessionDetailFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { id }, context: { session } }) => {
    if (!session?.user.id) return null;

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return null;

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
      with: {
        attendances: { with: { user: true } },
      },
    });

    if (!gameSession) return null;

    const attendeeUserIds = gameSession.attendances.map((a) => a.userId);
    const availablePlayers =
      attendeeUserIds.length > 0
        ? await db.query.users.findMany({ where: notInArray(users.id, attendeeUserIds) })
        : await db.query.users.findMany();

    return { gameSession, availablePlayers };
  });

export const adminSessionDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["admin", "sessions", id],
    queryFn: () => fetchAdminSessionDetailFn({ data: { id } }),
  });

export const createAdminSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }

    const validated = createSessionSchema.parse(data);

    await db.insert(sessions).values({
      startTime: new Date(validated.startTime),
      endTime: new Date(validated.endTime),
      courts: validated.courts,
      costPerCourt: validated.costPerCourt.toFixed(2),
      location: validated.location || null,
      locationMapUrl: validated.locationMapUrl || null,
      courtNumbers: validated.courtNumbers || null,
      maxPlayers: validated.maxPlayers,
      minBalance: validated.minBalance.toFixed(2),
      rsvpDeadline: validated.rsvpDeadline ? new Date(validated.rsvpDeadline) : null,
      note: validated.note,
      createdById: session.user.id,
    });

    return { type: "SUCCESS", value: undefined };
  });

export const updateAdminSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }

    const { sessionId, ...rest } = data as { sessionId: string } & Record<string, unknown>;
    const gameSession = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    if (!gameSession) return { type: "NOT_FOUND" };
    if (admin.role === "HOST" && gameSession.createdById !== admin.id) {
      return { type: "FORBIDDEN" };
    }
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot edit a locked session" };
    }

    const validated = updateSessionSchema.parse(rest);

    await db
      .update(sessions)
      .set({
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        courts: validated.courts,
        costPerCourt: validated.costPerCourt.toFixed(2),
        location: validated.location || null,
        locationMapUrl: validated.locationMapUrl || null,
        courtNumbers: validated.courtNumbers || null,
        maxPlayers: validated.maxPlayers,
        minBalance: validated.minBalance.toFixed(2),
        note: validated.note || null,
        rsvpDeadline: validated.rsvpDeadline ? new Date(validated.rsvpDeadline) : null,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    return { type: "SUCCESS", value: undefined };
  });

export const deleteSessionFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { sessionId }, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: { attendances: true, ledgerEntries: true },
    });
    if (!gameSession) return { type: "NOT_FOUND" };

    if (gameSession.ledgerEntries.length > 0) {
      // Group entries by user and sum — then reverse the net amount for each user
      const netByUser = new Map<string, number>();
      for (const entry of gameSession.ledgerEntries) {
        netByUser.set(entry.userId, (netByUser.get(entry.userId) ?? 0) + parseFloat(entry.amount));
      }
      for (const [uid, net] of Array.from(netByUser)) {
        const user = await db.query.users.findFirst({ where: eq(users.id, uid) });
        if (user && net !== 0) {
          const newBalance = (parseFloat(user.balance) - net).toFixed(2);
          await db
            .update(users)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(users.id, uid));
        }
      }
      await db.delete(ledger).where(eq(ledger.sessionId, sessionId));
    }

    await db.delete(attendances).where(eq(attendances.sessionId, sessionId));
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { type: "SUCCESS", value: undefined };
  });

export const lockSessionFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; shuttleCount: number; shuttleCost: number }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }

    const validated = lockSessionSchema.parse(data);

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, validated.sessionId),
      with: {
        attendances: {
          where: eq(attendances.status, "YES"),
          with: { user: true },
        },
        ledgerEntries: true,
      },
    });

    if (!gameSession) return { type: "NOT_FOUND" };
    if (admin.role === "HOST" && gameSession.createdById !== admin.id) {
      return { type: "FORBIDDEN" };
    }
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Session is already finalized" };
    }
    if (gameSession.endTime > new Date()) {
      return { type: "BUSINESS_ERROR", code: "Session can only be finalized after it ends" };
    }

    const confirmedAttendees = gameSession.attendances;
    if (confirmedAttendees.length === 0) {
      return { type: "BUSINESS_ERROR", code: "No confirmed attendees" };
    }

    const courtCost = gameSession.courts * parseFloat(gameSession.costPerCourt);
    const totalCost = courtCost + validated.shuttleCost;
    const costPerPlayer = totalCost / confirmedAttendees.length;
    const adminUserId = session.user.id;

    const heldDeposits = new Map<string, number>();
    for (const entry of gameSession.ledgerEntries) {
      if (entry.type === "SESSION_DEPOSIT" || entry.type === "SESSION_REFUND") {
        heldDeposits.set(
          entry.userId,
          (heldDeposits.get(entry.userId) ?? 0) - parseFloat(entry.amount),
        );
      }
    }

    const finalized = await db.transaction(async (tx) => {
      const [claimedSession] = await tx
        .update(sessions)
        .set({
          shuttleCount: validated.shuttleCount,
          shuttleCost: validated.shuttleCost.toFixed(2),
          totalCost: totalCost.toFixed(2),
          costPerPlayer: costPerPlayer.toFixed(2),
          status: "LOCKED",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sessions.id, validated.sessionId),
            eq(sessions.status, "OPEN"),
            lte(sessions.endTime, new Date()),
          ),
        )
        .returning({ id: sessions.id });

      if (!claimedSession) return false;

      for (const attendance of confirmedAttendees) {
        const user = attendance.user;
        const currentBalance = parseFloat(user.balance);
        const heldDeposit = Math.max(0, heldDeposits.get(user.id) ?? 0);
        const netCharge = costPerPlayer - heldDeposit;
        const newBalance = currentBalance - netCharge;

        if (netCharge !== 0) {
          await tx
            .update(users)
            .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
            .where(eq(users.id, user.id));

          await tx.insert(ledger).values({
            userId: user.id,
            type: netCharge > 0 ? "SESSION_DEBIT" : "SESSION_REFUND",
            amount: (-netCharge).toFixed(2),
            balanceAfter: newBalance.toFixed(2),
            note: netCharge > 0 ? "Session fee (balance due)" : "Session deposit refund",
            createdById: adminUserId,
            sessionId: validated.sessionId,
          });
        }

        await tx
          .update(attendances)
          .set({ finalCost: costPerPlayer.toFixed(2), updatedAt: new Date() })
          .where(eq(attendances.id, attendance.id));

        if (newBalance < 20 && user.fcmToken) {
          await sendLowBalanceNotification(user.fcmToken, newBalance.toFixed(2));
        }
      }

      return true;
    });

    if (!finalized) {
      return { type: "BUSINESS_ERROR", code: "Session is already finalized" };
    }

    return { type: "SUCCESS", value: undefined };
  });

export const addPlayerFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; userId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    const validated = addPlayerSchema.parse({ userId: data.userId });

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, data.sessionId),
    });
    if (!gameSession) return { type: "NOT_FOUND" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot add players to a locked session" };
    }

    const existing = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.sessionId, data.sessionId),
        eq(attendances.userId, validated.userId),
      ),
    });

    if (existing) {
      await db
        .update(attendances)
        .set({ status: "YES", updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));
    } else {
      await db.insert(attendances).values({
        sessionId: data.sessionId,
        userId: validated.userId,
        status: "YES",
      });
    }

    return { type: "SUCCESS", value: undefined };
  });

// ─── Top-Ups ──────────────────────────────────────────────────────────────────

export const fetchAdminTopUpsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return { pending: [], recent: [] };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { pending: [], recent: [] };

    const [pending, recent] = await Promise.all([
      db.query.topUpRequests.findMany({
        where: and(eq(topUpRequests.status, "PENDING"), eq(topUpRequests.isDeleted, false)),
        orderBy: [desc(topUpRequests.createdAt)],
        with: { user: true },
      }),
      db.query.topUpRequests.findMany({
        where: eq(topUpRequests.isDeleted, false),
        orderBy: [desc(topUpRequests.createdAt)],
        limit: 50,
        with: { user: true },
      }),
    ]);

    return { pending, recent };
  });

export const adminTopUpsQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "topups"],
    queryFn: () => fetchAdminTopUpsFn(),
  });

export const confirmTopUpFn = createServerFn({ method: "POST" })
  .validator((data: { requestId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { requestId }, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    const topUpRequest = await db.query.topUpRequests.findFirst({
      where: eq(topUpRequests.id, requestId),
      with: { user: true },
    });
    if (!topUpRequest || topUpRequest.status !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "Invalid request" };
    }

    const amount = parseFloat(topUpRequest.amount);
    const currentBalance = parseFloat(topUpRequest.user.balance);
    const newBalance = currentBalance + amount;
    const adminUserId = session.user.id;

    await db.transaction(async (tx) => {
      await tx
        .update(topUpRequests)
        .set({ status: "CONFIRMED", confirmedAt: new Date(), confirmedBy: adminUserId })
        .where(eq(topUpRequests.id, requestId));

      await tx
        .update(users)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(users.id, topUpRequest.userId));

      await tx.insert(ledger).values({
        userId: topUpRequest.userId,
        type: "TOPUP",
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        note: "Top-up confirmed",
        createdById: adminUserId,
        topUpRequestId: requestId,
      });
    });

    if (topUpRequest.user.fcmToken) {
      await sendTopUpConfirmedNotification(topUpRequest.user.fcmToken, amount.toFixed(2));
    }

    return { type: "SUCCESS", value: undefined };
  });

export const rejectTopUpFn = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; reason: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };

    const validated = rejectTopUpSchema.parse({ requestId: data.requestId, reason: data.reason });

    const topUpRequest = await db.query.topUpRequests.findFirst({
      where: eq(topUpRequests.id, validated.requestId),
      with: { user: true },
    });
    if (!topUpRequest || topUpRequest.status !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "Invalid request" };
    }

    await db
      .update(topUpRequests)
      .set({
        status: "REJECTED",
        rejectReason: validated.reason,
        confirmedAt: new Date(),
        confirmedBy: session.user.id,
      })
      .where(eq(topUpRequests.id, validated.requestId));

    if (topUpRequest.user.fcmToken) {
      await sendTopUpRejectedNotification(
        topUpRequest.user.fcmToken,
        topUpRequest.amount,
        validated.reason,
      );
    }

    return { type: "SUCCESS", value: undefined };
  });

// ─── Members ─────────────────────────────────────────────────────────────────

export const fetchMembersFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return [];

    return db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });
  });

export const membersQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "members"],
    queryFn: () => fetchMembersFn(),
  });

// ─── Pool Balance ─────────────────────────────────────────────────────────────

export const fetchPoolBalanceFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || admin.role !== "ADMIN") return null;

    const [topupsResult, debitsResult, withdrawalsResult] = await Promise.all([
      db
        .select({ total: sum(ledger.amount) })
        .from(ledger)
        .where(eq(ledger.type, "TOPUP")),
      db
        .select({ total: sum(ledger.amount) })
        .from(ledger)
        .where(eq(ledger.type, "SESSION_DEBIT")),
      db
        .select({ total: sum(withdrawalRequests.amount) })
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, "CONFIRMED")),
    ]);

    const totalTopups = parseFloat(topupsResult[0]?.total ?? "0");
    const totalDebits = Math.abs(parseFloat(debitsResult[0]?.total ?? "0"));
    const totalWithdrawals = parseFloat(withdrawalsResult[0]?.total ?? "0");
    const remaining = totalTopups - totalDebits - totalWithdrawals;

    return { totalTopups, totalDebits, totalWithdrawals, remaining };
  });

export const poolBalanceQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "pool-balance"],
    queryFn: () => fetchPoolBalanceFn(),
  });
