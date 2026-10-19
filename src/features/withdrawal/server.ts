import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { withdrawalRequests, users, ledger } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { withdrawalRequestSchema, rejectWithdrawalSchema } from "@/lib/validations";
import { getAdminFcmTokens, requireAdmin, type Result } from "@/lib/guards";
import {
  sendNewWithdrawalRequestNotification,
  sendWithdrawalConfirmedNotification,
  sendWithdrawalRejectedNotification,
} from "@/lib/push";
import { appendWithdrawalToSheet, SheetSyncError } from "@/lib/google-sheet";

export const fetchWithdrawalsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    return db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.userId, session.user.id),
      orderBy: [desc(withdrawalRequests.createdAt)],
      limit: 20,
    });
  });

export const withdrawalsQueryOptions = () =>
  queryOptions({
    queryKey: ["withdrawals"],
    queryFn: () => fetchWithdrawalsFn(),
  });

/**
 * How much the player can still request: balance minus every pending withdrawal.
 * Checked fresh when the withdraw dialog opens so a second request can't push
 * the pending total past the balance.
 */
export const fetchWithdrawableFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return { balance: "0", pending: "0", available: "0" };

    const [user, pendingWithdrawals] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { balance: true },
      }),
      db.query.withdrawalRequests.findMany({
        where: and(
          eq(withdrawalRequests.userId, session.user.id),
          eq(withdrawalRequests.status, "PENDING"),
        ),
        columns: { amount: true },
      }),
    ]);

    const balance = parseFloat(user?.balance ?? "0");
    const pending = pendingWithdrawals.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    return {
      balance: balance.toFixed(2),
      pending: pending.toFixed(2),
      available: (balance - pending).toFixed(2),
    };
  });

export const withdrawableQueryOptions = () =>
  queryOptions({
    queryKey: ["withdrawable"],
    queryFn: () => fetchWithdrawableFn(),
  });

export const fetchSavedPaymentDetailsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { duitnowPhone: true, savedBankName: true, savedAccountNumber: true },
    });

    return {
      duitnowPhone: user?.duitnowPhone ?? null,
      bankName: user?.savedBankName ?? null,
      accountNumber: user?.savedAccountNumber ?? null,
    };
  });

export const savedPaymentDetailsQueryOptions = () =>
  queryOptions({
    queryKey: ["saved-payment-details"],
    queryFn: () => fetchSavedPaymentDetailsFn(),
  });

export const createWithdrawalFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      amount: number;
      paymentMethod: "BANK" | "DUITNOW";
      bankName?: string;
      accountNumber?: string;
      duitnowPhone?: string;
      note?: string;
    }) => data,
  )
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = withdrawalRequestSchema.parse(data);

    const [user, pendingWithdrawals] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
      db.query.withdrawalRequests.findMany({
        where: and(
          eq(withdrawalRequests.userId, session.user.id),
          eq(withdrawalRequests.status, "PENDING"),
        ),
        columns: { amount: true },
      }),
    ]);

    // Several requests can be pending at once. What's withdrawable is the
    // balance minus everything already awaiting payout, so the sum of pending
    // requests can never exceed the balance.
    const pendingTotal = pendingWithdrawals.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const available = parseFloat(user?.balance ?? "0") - pendingTotal;

    if (!user || available < validated.amount) {
      return { type: "BUSINESS_ERROR", code: "INSUFFICIENT_BALANCE" };
    }

    const userId = session.user.id;

    await db.transaction(async (tx) => {
      if (validated.paymentMethod === "DUITNOW") {
        await tx
          .update(users)
          .set({ duitnowPhone: validated.duitnowPhone })
          .where(eq(users.id, userId));

        await tx.insert(withdrawalRequests).values({
          userId,
          amount: validated.amount.toFixed(2),
          paymentMethod: "DUITNOW",
          duitnowPhone: validated.duitnowPhone,
          note: validated.note,
        });
      } else {
        await tx
          .update(users)
          .set({ savedBankName: validated.bankName, savedAccountNumber: validated.accountNumber })
          .where(eq(users.id, userId));

        await tx.insert(withdrawalRequests).values({
          userId,
          amount: validated.amount.toFixed(2),
          paymentMethod: "BANK",
          bankName: validated.bankName,
          accountNumber: validated.accountNumber,
          note: validated.note,
        });
      }
    });

    // Alert admins with push enabled. Best-effort — a notification failure must
    // never fail the request that was already saved.
    try {
      const adminTokens = await getAdminFcmTokens();
      if (adminTokens.length > 0) {
        await sendNewWithdrawalRequestNotification(
          adminTokens,
          user.name ?? "A player",
          validated.amount.toFixed(2),
        );
      }
    } catch (error) {
      console.error("Failed to notify admins of withdrawal request:", error);
    }

    return { type: "SUCCESS", value: undefined };
  });

// ─── Admin resolution ─────────────────────────────────────────────────────────

export const fetchAdminWithdrawalsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return { pending: [], recent: [] };
    if (!(await requireAdmin(session.user.id))) return { pending: [], recent: [] };

    const [pending, recent] = await Promise.all([
      db.query.withdrawalRequests.findMany({
        where: eq(withdrawalRequests.status, "PENDING"),
        orderBy: [desc(withdrawalRequests.createdAt)],
        with: { user: true },
      }),
      db.query.withdrawalRequests.findMany({
        orderBy: [desc(withdrawalRequests.createdAt)],
        limit: 50,
        with: { user: true },
      }),
    ]);

    return { pending, recent };
  });

export const adminWithdrawalsQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "withdrawals"],
    queryFn: () => fetchAdminWithdrawalsFn(),
  });

export const confirmWithdrawalFn = createServerFn({ method: "POST" })
  .validator((data: { requestId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data: { requestId }, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const [admin, request] = await Promise.all([
      requireAdmin(session.user.id),
      db.query.withdrawalRequests.findFirst({
        where: eq(withdrawalRequests.id, requestId),
        with: { user: true },
      }),
    ]);
    if (!admin) return { type: "FORBIDDEN" };
    if (!request) return { type: "NOT_FOUND" };
    if (request.status !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "Invalid request" };
    }

    const amount = parseFloat(request.amount);
    const adminUserId = session.user.id;

    // The balance was never reserved when the request was created, so the
    // player may have spent it on a session in the meantime. Re-check inside
    // the transaction rather than letting the balance go negative.
    const confirmedAt = new Date();

    let confirmed: boolean;
    try {
      confirmed = await db.transaction(async (tx) => {
        const current = await tx.query.users.findFirst({ where: eq(users.id, request.userId) });
        if (!current) return false;

        const currentBalance = parseFloat(current.balance);
        if (currentBalance < amount) return false;

        const newBalance = currentBalance - amount;

        const [claimed] = await tx
          .update(withdrawalRequests)
          .set({ status: "CONFIRMED", resolvedAt: confirmedAt, resolvedBy: adminUserId })
          .where(
            and(eq(withdrawalRequests.id, requestId), eq(withdrawalRequests.status, "PENDING")),
          )
          .returning({ id: withdrawalRequests.id });

        if (!claimed) return false;

        await tx
          .update(users)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(users.id, request.userId));

        await tx.insert(ledger).values({
          userId: request.userId,
          type: "WITHDRAWAL",
          amount: (-amount).toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          note: "Withdrawal paid out",
          createdById: adminUserId,
          withdrawalRequestId: requestId,
        });

        // Inside the transaction so a failed sync rolls the payout back. Unlike
        // top-ups, balanceAfter is only known here (the balance is re-checked
        // against concurrent spending), so this can't run before the write.
        await appendWithdrawalToSheet({
          confirmedAt: confirmedAt.toISOString(),
          requestId,
          memberName: request.user.name ?? "",
          memberEmail: request.user.email ?? "",
          amount: amount.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          paymentMethod: request.paymentMethod ?? "",
          confirmedBy: admin.name ?? admin.email ?? adminUserId,
        });

        return true;
      });
    } catch (error) {
      if (error instanceof SheetSyncError) {
        return {
          type: "BUSINESS_ERROR",
          code: "Couldn't record this withdrawal in the Google Sheet, so it was not marked paid. Please try again.",
        };
      }
      throw error;
    }

    if (!confirmed) {
      return { type: "BUSINESS_ERROR", code: "INSUFFICIENT_BALANCE" };
    }

    if (request.user.fcmToken) {
      await sendWithdrawalConfirmedNotification(request.user.fcmToken, amount.toFixed(2));
    }

    return { type: "SUCCESS", value: undefined };
  });

export const rejectWithdrawalFn = createServerFn({ method: "POST" })
  .validator((data: { requestId: string; reason: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = rejectWithdrawalSchema.parse(data);

    const [admin, request] = await Promise.all([
      requireAdmin(session.user.id),
      db.query.withdrawalRequests.findFirst({
        where: eq(withdrawalRequests.id, validated.requestId),
        with: { user: true },
      }),
    ]);
    if (!admin) return { type: "FORBIDDEN" };
    if (!request) return { type: "NOT_FOUND" };
    if (request.status !== "PENDING") {
      return { type: "BUSINESS_ERROR", code: "Invalid request" };
    }

    // No balance change — nothing was ever deducted when the request was made.
    await db
      .update(withdrawalRequests)
      .set({
        status: "REJECTED",
        rejectReason: validated.reason,
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
      })
      .where(eq(withdrawalRequests.id, validated.requestId));

    if (request.user.fcmToken) {
      await sendWithdrawalRejectedNotification(
        request.user.fcmToken,
        request.amount,
        validated.reason,
      );
    }

    return { type: "SUCCESS", value: undefined };
  });
