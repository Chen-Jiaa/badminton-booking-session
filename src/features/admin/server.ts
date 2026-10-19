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
  expenses,
  matches,
} from "@/db/schema";
import { eq, lte, desc, and, inArray, notInArray, TransactionRollbackError } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import {
  createSessionSchema,
  updateSessionSchema,
  lockSessionSchema,
  addPlayerSchema,
  rejectTopUpSchema,
  resolveLateCancelSchema,
  promoteWaitlistSchema,
} from "@/lib/validations";
import { promoteFromWaitlist, refundDeposit } from "@/features/sessions/roster";
import { canManageSession } from "@/features/sessions/rules";
import { templateFromSession, type SessionTemplate } from "@/features/admin/session-template";
import {
  sendLateCancelResolvedNotification,
  sendWaitlistPromotedNotification,
  sendLowBalanceNotification,
  sendTopUpConfirmedNotification,
  sendTopUpRejectedNotification,
} from "@/lib/push";
import { appendTopUpToSheet, SheetSyncError } from "@/lib/google-sheet";

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
    staleTime: 10 * 60 * 1000, // courts rarely change
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

/**
 * Prefill for the create form: the session in `from` (Duplicate), else the host's own
 * latest session, else the club's latest. Null when there's nothing to copy.
 */
export const fetchSessionTemplateFn = createServerFn({ method: "GET" })
  .validator((data: { from?: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<SessionTemplate | null> => {
    if (!session?.user.id) return null;

    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!user || (user.role !== "ADMIN" && user.role !== "HOST")) return null;

    const source =
      (data.from && (await db.query.sessions.findFirst({ where: eq(sessions.id, data.from) }))) ||
      (await db.query.sessions.findFirst({
        where: eq(sessions.createdById, user.id),
        orderBy: [desc(sessions.startTime)],
      })) ||
      (await db.query.sessions.findFirst({ orderBy: [desc(sessions.startTime)] }));

    return source ? templateFromSession(source) : null;
  });

export const sessionTemplateQueryOptions = (from?: string) =>
  queryOptions({
    queryKey: ["sessions", "template", from ?? "latest"],
    queryFn: () => fetchSessionTemplateFn({ data: { from } }),
    staleTime: 0,
  });

export const createAdminSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result<{ id: string }>> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const admin = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }

    const validated = createSessionSchema.parse(data);
    const creatorId = session.user.id;
    const courtCost = validated.courts * validated.costPerCourt;

    let newSessionId = "";

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(sessions)
        .values({
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
          createdById: creatorId,
        })
        .returning({ id: sessions.id });

      newSessionId = created.id;

      // The court is booked and paid for upfront by whoever creates the session,
      // so the money is already gone — record it as paid now rather than at lock.
      // It stays unreimbursed until they're paid back out of the club pot.
      await tx.insert(expenses).values({
        sessionId: created.id,
        category: "COURT_RENTAL",
        amount: courtCost.toFixed(2),
        paidAt: new Date(),
        paidById: creatorId,
        createdById: creatorId,
      });
    });

    return { type: "SUCCESS", value: { id: newSessionId } };
  });

export const updateAdminSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const { sessionId, ...rest } = data as { sessionId: string } & Record<string, unknown>;
    const [admin, gameSession] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) }),
    ]);
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }
    if (!gameSession) return { type: "NOT_FOUND" };
    if (admin.role === "HOST" && gameSession.createdById !== admin.id) {
      return { type: "FORBIDDEN" };
    }
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot edit a locked session" };
    }

    const validated = updateSessionSchema.parse(rest);
    const courtCost = validated.courts * validated.costPerCourt;

    await db.transaction(async (tx) => {
      await tx
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

      // Keep the recorded spend in step with the booking. Skipped once the
      // expense has been reimbursed — that money has already changed hands, so
      // rewriting it would falsify a settled figure.
      await tx
        .update(expenses)
        .set({ amount: courtCost.toFixed(2) })
        .where(
          and(
            eq(expenses.sessionId, sessionId),
            eq(expenses.category, "COURT_RENTAL"),
            eq(expenses.isDeleted, false),
            eq(expenses.reimbursed, false),
          ),
        );
    });

    return { type: "SUCCESS", value: undefined };
  });

export const deleteSessionFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { sessionId }, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const [admin, gameSession] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        with: { attendances: true, ledgerEntries: true },
      }),
    ]);
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) return { type: "FORBIDDEN" };
    if (!gameSession) return { type: "NOT_FOUND" };
    if (admin.role === "HOST" && gameSession.createdById !== admin.id) return { type: "FORBIDDEN" };
    if (admin.role === "HOST" && gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot cancel a finalized session" };
    }

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

    // Unlink every expense from the session before the row goes (the FK has no
    // cascade). Unreimbursed spend is soft-deleted so it drops out of the finance
    // figures — but a reimbursed expense is real cash that already left the club
    // pot, so it must survive the cancellation and keep counting as cash-out.
    // Deleting it would erase the outflow and inflate the surplus.
    await db
      .update(expenses)
      .set({ isDeleted: true, sessionId: null })
      .where(and(eq(expenses.sessionId, sessionId), eq(expenses.reimbursed, false)));

    await db
      .update(expenses)
      .set({ sessionId: null })
      .where(and(eq(expenses.sessionId, sessionId), eq(expenses.reimbursed, true)));

    // match_players rows go with their match (ON DELETE CASCADE)
    await db.delete(matches).where(eq(matches.sessionId, sessionId));
    await db.delete(attendances).where(eq(attendances.sessionId, sessionId));
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { type: "SUCCESS", value: undefined };
  });

export const lockSessionFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      shuttleCount: number;
      shuttleCost: number;
      shuttleSupplierId?: string | null;
    }) => data,
  )
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = lockSessionSchema.parse(data);

    const [admin, gameSession] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.sessions.findFirst({
        where: eq(sessions.id, validated.sessionId),
        with: {
          attendances: {
            where: eq(attendances.status, "YES"),
            with: { user: true },
          },
          ledgerEntries: true,
        },
      }),
    ]);

    if (!admin || (admin.role !== "ADMIN" && admin.role !== "HOST")) {
      return { type: "FORBIDDEN" };
    }
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
    if (confirmedAttendees.some((a) => a.lateCancelStatus === "PENDING")) {
      return {
        type: "BUSINESS_ERROR",
        code: "Approve or reject the pending late cancellations first",
      };
    }
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

      // The court rental was already recorded as paid when the session was
      // created, so nothing to add for it here.
      //
      // Shuttles only become an expense when someone brought their own. Club
      // stock was already expensed at bulk purchase, so charging players for it
      // is recovery, not new spend — recording it again would double-count.
      if (validated.shuttleCost > 0 && validated.shuttleSupplierId) {
        await tx.insert(expenses).values({
          sessionId: validated.sessionId,
          category: "SHUTTLES",
          amount: validated.shuttleCost.toFixed(2),
          note: `${validated.shuttleCount} shuttle${validated.shuttleCount === 1 ? "" : "s"} (own stock)`,
          paidAt: new Date(),
          paidById: validated.shuttleSupplierId,
          createdById: adminUserId,
        });
      }

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

    const validated = addPlayerSchema.parse({ userId: data.userId });

    const [admin, gameSession, existing] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.sessions.findFirst({ where: eq(sessions.id, data.sessionId) }),
      db.query.attendances.findFirst({
        where: and(
          eq(attendances.sessionId, data.sessionId),
          eq(attendances.userId, validated.userId),
        ),
      }),
    ]);

    if (!gameSession) return { type: "NOT_FOUND" };
    if (!canManageSession(admin, gameSession)) return { type: "FORBIDDEN" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot add players to a locked session" };
    }

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

export const removePlayerFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; userId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const [admin, gameSession, player, existing, depositLedger] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.sessions.findFirst({ where: eq(sessions.id, data.sessionId) }),
      db.query.users.findFirst({ where: eq(users.id, data.userId) }),
      db.query.attendances.findFirst({
        where: and(eq(attendances.sessionId, data.sessionId), eq(attendances.userId, data.userId)),
      }),
      db.query.ledger.findMany({
        where: and(
          eq(ledger.sessionId, data.sessionId),
          eq(ledger.userId, data.userId),
          inArray(ledger.type, ["SESSION_DEPOSIT", "SESSION_REFUND"]),
        ),
      }),
    ]);

    if (!gameSession) return { type: "NOT_FOUND" };
    if (!canManageSession(admin, gameSession)) return { type: "FORBIDDEN" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Cannot remove players from a locked session" };
    }
    if (!existing) return { type: "SUCCESS", value: undefined };

    // Refund whatever deposit the player is actually holding for this session — the
    // net of their SESSION_DEPOSIT/SESSION_REFUND ledger rows, not the session's
    // current minBalance. The deposit was taken at the amount in force when they
    // joined, so a later edit to minBalance must not change what's returned. If it
    // nets to zero (never joined, or already refunded) there's nothing to reverse
    // and we just drop the attendance row.
    const heldDeposit = -depositLedger.reduce((total, e) => total + parseFloat(e.amount), 0);
    if (player && heldDeposit > 0) {
      const adminUserId = session.user.id;
      await db.transaction(async (tx) => {
        const newBalance = (parseFloat(player.balance) + heldDeposit).toFixed(2);
        await tx
          .update(users)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(users.id, player.id));

        await tx.insert(ledger).values({
          userId: player.id,
          type: "SESSION_REFUND",
          amount: heldDeposit.toFixed(2),
          balanceAfter: newBalance,
          note: "Deposit refund",
          createdById: adminUserId,
          sessionId: data.sessionId,
        });

        await tx.delete(attendances).where(eq(attendances.id, existing.id));
      });
    } else {
      await db.delete(attendances).where(eq(attendances.id, existing.id));
    }

    return { type: "SUCCESS", value: undefined };
  });

// ─── Late cancellations & waitlist ───────────────────────────────────────────

export const resolveLateCancelFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sessionId: string;
      userId: string;
      decision: "APPROVE" | "REJECT";
      replacementUserId?: string | null;
    }) => data,
  )
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = resolveLateCancelSchema.parse(data);
    const actorId = session.user.id;

    const [actor, gameSession, request] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, actorId) }),
      db.query.sessions.findFirst({ where: eq(sessions.id, validated.sessionId) }),
      db.query.attendances.findFirst({
        where: and(
          eq(attendances.sessionId, validated.sessionId),
          eq(attendances.userId, validated.userId),
        ),
        with: { user: true },
      }),
    ]);

    if (!gameSession) return { type: "NOT_FOUND" };
    if (!canManageSession(actor, gameSession)) return { type: "FORBIDDEN" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Session is already finalized" };
    }
    if (!request || request.status !== "YES" || request.lateCancelStatus !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "This cancellation has already been handled" };
    }

    const now = new Date();
    const resolved = { lateCancelResolvedAt: now, lateCancelResolvedById: actorId, updatedAt: now };

    if (validated.decision === "REJECT") {
      // They stay on the roster, deposit held, and pay their full share at finalize
      await db
        .update(attendances)
        .set({ lateCancelStatus: "REJECTED", ...resolved })
        .where(eq(attendances.id, request.id));
    } else {
      const outcome = await db
        .transaction(async (tx) => {
          await refundDeposit(tx, { sessionId: gameSession.id, userId: request.userId, actorId });
          await tx
            .update(attendances)
            .set({ status: "NO", lateCancelStatus: "APPROVED", ...resolved })
            .where(eq(attendances.id, request.id));

          if (!validated.replacementUserId) return { promoted: null };
          const promoted = await promoteFromWaitlist(tx, {
            session: gameSession,
            actorId,
            userId: validated.replacementUserId,
          });
          // Roll the whole approval back rather than approve without the agreed swap
          if (!promoted) tx.rollback();
          return { promoted };
        })
        .catch((error) => {
          if (error instanceof TransactionRollbackError) return null;
          throw error;
        });

      if (!outcome) {
        return {
          type: "BUSINESS_ERROR",
          code: "Couldn't move that player in — they may not have enough balance",
        };
      }
      if (outcome.promoted?.fcmToken) {
        await sendWaitlistPromotedNotification(
          outcome.promoted.fcmToken,
          gameSession.id,
          gameSession.startTime,
        );
      }
    }

    if (request.user.fcmToken) {
      await sendLateCancelResolvedNotification(
        request.user.fcmToken,
        validated.decision === "APPROVE",
        gameSession.id,
        gameSession.startTime,
      );
    }

    return { type: "SUCCESS", value: undefined };
  });

/** Moves a waitlisted player into an open spot (takes their deposit). */
export const promoteWaitlistFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; userId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = promoteWaitlistSchema.parse(data);
    const actorId = session.user.id;

    const [actor, gameSession] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, actorId) }),
      db.query.sessions.findFirst({ where: eq(sessions.id, validated.sessionId) }),
    ]);

    if (!gameSession) return { type: "NOT_FOUND" };
    if (!canManageSession(actor, gameSession)) return { type: "FORBIDDEN" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Session is already finalized" };
    }

    const promoted = await db.transaction((tx) =>
      promoteFromWaitlist(tx, { session: gameSession, actorId, userId: validated.userId }),
    );
    if (!promoted) {
      return {
        type: "BUSINESS_ERROR",
        code: "Can't move them in — the session is full or they're short on balance",
      };
    }

    if (promoted.fcmToken) {
      await sendWaitlistPromotedNotification(
        promoted.fcmToken,
        gameSession.id,
        gameSession.startTime,
      );
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

    const [admin, topUpRequest] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.topUpRequests.findFirst({
        where: eq(topUpRequests.id, requestId),
        with: { user: true },
      }),
    ]);
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };
    if (!topUpRequest || topUpRequest.status !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "Invalid request" };
    }

    const amount = parseFloat(topUpRequest.amount);
    const currentBalance = parseFloat(topUpRequest.user.balance);
    const newBalance = currentBalance + amount;
    const adminUserId = session.user.id;

    const confirmedAt = new Date();

    // Sync to the sheet first, *outside* the transaction, so we never hold a DB
    // connection open across the network round-trip. If it fails we return here
    // having touched nothing — no balances changed, so there's nothing to roll
    // back. (The reverse gap — a sheet row followed by a failed local write — is
    // negligible: a 3-statement transaction almost never fails, and a stray row
    // is harmless next to a wrong balance.)
    try {
      await appendTopUpToSheet({
        confirmedAt: confirmedAt.toISOString(),
        requestId,
        memberName: topUpRequest.user.name ?? "",
        memberEmail: topUpRequest.user.email ?? "",
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        confirmedBy: admin.name ?? admin.email ?? adminUserId,
      });
    } catch (error) {
      if (error instanceof SheetSyncError) {
        return {
          type: "BUSINESS_ERROR",
          code: "Couldn't record this top-up in the Google Sheet, so it was not confirmed. Please try again.",
        };
      }
      throw error;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(topUpRequests)
        .set({ status: "CONFIRMED", confirmedAt, confirmedBy: adminUserId })
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

    const validated = rejectTopUpSchema.parse({ requestId: data.requestId, reason: data.reason });

    const [admin, topUpRequest] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.topUpRequests.findFirst({
        where: eq(topUpRequests.id, validated.requestId),
        with: { user: true },
      }),
    ]);
    if (!admin || admin.role !== "ADMIN") return { type: "FORBIDDEN" };
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

// Member picker for hosts: who brought their own shuttles, who walked in.
// HOSTs run their own sessions but aren't allowed the full member list
// (balances, roles) that fetchMembersFn returns, so this exposes just
// id + name to ADMIN and HOST, nothing more.
export const fetchMemberNamesFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    const requester = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!requester || (requester.role !== "ADMIN" && requester.role !== "HOST")) return [];

    return db.query.users.findMany({
      columns: { id: true, name: true },
      orderBy: [desc(users.createdAt)],
    });
  });

export const memberNamesQueryOptions = () =>
  queryOptions({
    queryKey: ["member-names"],
    queryFn: () => fetchMemberNamesFn(),
  });
