import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { expenses, ledger, sessions, users, withdrawalRequests } from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, isNotNull, lte, sum } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { createExpenseSchema, updateExpenseSchema, manualAdjustSchema } from "@/lib/validations";
import { requireAdmin, type Result } from "@/lib/guards";
import {
  computeFinanceSummary,
  expenseLabel,
  type FinanceSummary,
} from "@/features/finance/format";

export type { FinanceSummary };

/** Who fronted money that hasn't been paid back yet. */
export type OwedToPayer = { id: string; name: string; amount: number };

export type ExpenseFilter = {
  from?: string;
  to?: string;
  category?: "COURT_RENTAL" | "SHUTTLES" | "OTHER";
  status?: "ALL" | "UNPAID" | "PAID" | "REIMBURSED";
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const fetchExpensesFn = createServerFn({ method: "GET" })
  .validator((data: ExpenseFilter | undefined) => data ?? {})
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }) => {
    if (!session?.user.id) return [];
    if (!(await requireAdmin(session.user.id))) return [];

    const filters = [eq(expenses.isDeleted, false)];
    if (data.from) filters.push(gte(expenses.createdAt, new Date(data.from)));
    if (data.to) filters.push(lte(expenses.createdAt, new Date(data.to)));
    if (data.category) filters.push(eq(expenses.category, data.category));
    if (data.status === "UNPAID") filters.push(isNull(expenses.paidAt));
    if (data.status === "PAID") {
      filters.push(isNotNull(expenses.paidAt), eq(expenses.reimbursed, false));
    }
    if (data.status === "REIMBURSED") filters.push(eq(expenses.reimbursed, true));

    return db.query.expenses.findMany({
      where: and(...filters),
      orderBy: [desc(expenses.createdAt)],
      with: { session: true, paidBy: true },
    });
  });

export const expensesQueryOptions = (filter: ExpenseFilter = {}) =>
  queryOptions({
    queryKey: ["admin", "expenses", filter],
    queryFn: () => fetchExpensesFn({ data: filter }),
  });

export const createExpenseFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const validated = createExpenseSchema.parse(data);
    const paidAt = validated.paidAt ? new Date(validated.paidAt) : null;

    await db.insert(expenses).values({
      category: validated.category,
      amount: validated.amount.toFixed(2),
      sessionId: validated.sessionId ?? null,
      paidAt,
      // if it's already been paid, the admin recording it is the one out of pocket
      paidById: paidAt ? session.user.id : null,
      note: validated.note ?? null,
      receiptUrl: validated.receiptUrl ?? null,
      createdById: session.user.id,
    });

    return { type: "SUCCESS", value: undefined };
  });

export const updateExpenseFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const validated = updateExpenseSchema.parse(data);

    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, validated.expenseId), eq(expenses.isDeleted, false)),
    });
    if (!existing) return { type: "NOT_FOUND" };

    await db
      .update(expenses)
      .set({
        category: validated.category,
        amount: validated.amount.toFixed(2),
        note: validated.note ?? null,
      })
      .where(eq(expenses.id, validated.expenseId));

    return { type: "SUCCESS", value: undefined };
  });

export const markExpensePaidFn = createServerFn({ method: "POST" })
  .validator((data: { expenseId: string; paid: boolean }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, data.expenseId), eq(expenses.isDeleted, false)),
    });
    if (!existing) return { type: "NOT_FOUND" };
    if (data.paid === false && existing.reimbursed) {
      return { type: "BUSINESS_ERROR", code: "Un-reimburse this expense first" };
    }

    await db
      .update(expenses)
      .set(
        data.paid
          ? { paidAt: new Date(), paidById: session.user.id }
          : { paidAt: null, paidById: null },
      )
      .where(eq(expenses.id, data.expenseId));

    return { type: "SUCCESS", value: undefined };
  });

export const markExpenseReimbursedFn = createServerFn({ method: "POST" })
  .validator((data: { expenseId: string; reimbursed: boolean }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, data.expenseId), eq(expenses.isDeleted, false)),
    });
    if (!existing) return { type: "NOT_FOUND" };
    if (data.reimbursed && !existing.paidAt) {
      return { type: "BUSINESS_ERROR", code: "Mark the expense paid first" };
    }

    await db
      .update(expenses)
      .set(
        data.reimbursed
          ? { reimbursed: true, reimbursedAt: new Date() }
          : { reimbursed: false, reimbursedAt: null },
      )
      .where(eq(expenses.id, data.expenseId));

    return { type: "SUCCESS", value: undefined };
  });

export const deleteExpenseFn = createServerFn({ method: "POST" })
  .validator((data: { expenseId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const existing = await db.query.expenses.findFirst({
      where: and(eq(expenses.id, data.expenseId), eq(expenses.isDeleted, false)),
    });
    if (!existing) return { type: "NOT_FOUND" };
    // A reimbursed expense is real cash that already left the club pot. Soft-
    // deleting it drops it from expensesReimbursed and inflates the surplus, so
    // it has to be un-reimbursed first — same guard markExpensePaidFn uses.
    if (existing.reimbursed) {
      return { type: "BUSINESS_ERROR", code: "Un-reimburse this expense before deleting it" };
    }

    await db.update(expenses).set({ isDeleted: true }).where(eq(expenses.id, data.expenseId));

    return { type: "SUCCESS", value: undefined };
  });

// ─── Manual adjustments ───────────────────────────────────────────────────────

export const createManualAdjustFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };
    if (!(await requireAdmin(session.user.id))) return { type: "FORBIDDEN" };

    const validated = manualAdjustSchema.parse(data);
    if (validated.amount === 0) {
      return { type: "BUSINESS_ERROR", code: "Amount cannot be zero" };
    }

    const target = await db.query.users.findFirst({ where: eq(users.id, validated.userId) });
    if (!target) return { type: "NOT_FOUND" };

    const newBalance = parseFloat(target.balance) + validated.amount;
    const adminUserId = session.user.id;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(users.id, validated.userId));

      await tx.insert(ledger).values({
        userId: validated.userId,
        type: "MANUAL_ADJUST",
        amount: validated.amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        note: validated.note,
        createdById: adminUserId,
      });
    });

    return { type: "SUCCESS", value: undefined };
  });

// ─── Summary ──────────────────────────────────────────────────────────────────

export const fetchFinanceSummaryFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(
    async ({
      context: { session },
    }): Promise<(FinanceSummary & { owedBreakdown: OwedToPayer[] }) | null> => {
      if (!session?.user.id) return null;
      if (!(await requireAdmin(session.user.id))) return null;

      const [
        topupsResult,
        withdrawalsResult,
        reimbursedResult,
        unreimbursedResult,
        unpaidResult,
        balancesResult,
        depositsResult,
        owedBreakdownResult,
        openSessionExpensesResult,
      ] = await Promise.all([
        // Ledger TOPUP rows only exist for confirmed top-ups, so this is real cash in.
        db
          .select({ total: sum(ledger.amount) })
          .from(ledger)
          .where(eq(ledger.type, "TOPUP")),
        db
          .select({ total: sum(withdrawalRequests.amount) })
          .from(withdrawalRequests)
          .where(eq(withdrawalRequests.status, "CONFIRMED")),
        db
          .select({ total: sum(expenses.amount) })
          .from(expenses)
          .where(and(eq(expenses.isDeleted, false), eq(expenses.reimbursed, true))),
        db
          .select({ total: sum(expenses.amount) })
          .from(expenses)
          .where(
            and(
              eq(expenses.isDeleted, false),
              eq(expenses.reimbursed, false),
              isNotNull(expenses.paidAt),
            ),
          ),
        db
          .select({ total: sum(expenses.amount) })
          .from(expenses)
          .where(and(eq(expenses.isDeleted, false), isNull(expenses.paidAt))),
        db.select({ total: sum(users.balance) }).from(users),
        // Deposits held against sessions that haven't been settled yet. These are
        // already out of users.balance, so they must be added back to get the
        // club's true liability to its members.
        db
          .select({ total: sum(ledger.amount) })
          .from(ledger)
          .innerJoin(sessions, eq(ledger.sessionId, sessions.id))
          .where(
            and(
              eq(sessions.status, "OPEN"),
              inArray(ledger.type, ["SESSION_DEPOSIT", "SESSION_REFUND"]),
            ),
          ),
        // Sessions can be created by any HOST, so more than one person may be
        // out of pocket at a time.
        db
          .select({ id: users.id, name: users.name, total: sum(expenses.amount) })
          .from(expenses)
          .innerJoin(users, eq(expenses.paidById, users.id))
          .where(
            and(
              eq(expenses.isDeleted, false),
              eq(expenses.reimbursed, false),
              isNotNull(expenses.paidAt),
            ),
          )
          .groupBy(users.id, users.name),
        // Spend on sessions that haven't been settled — players will be charged
        // for this at lock, so it's owed-but-earmarked rather than a real hole.
        db
          .select({ total: sum(expenses.amount) })
          .from(expenses)
          .innerJoin(sessions, eq(expenses.sessionId, sessions.id))
          .where(
            and(
              eq(expenses.isDeleted, false),
              eq(expenses.reimbursed, false),
              eq(sessions.status, "OPEN"),
            ),
          ),
      ]);

      const num = (v: string | null | undefined) => parseFloat(v ?? "0") || 0;

      const cashIn = num(topupsResult[0]?.total);
      const withdrawalsPaid = num(withdrawalsResult[0]?.total);
      const expensesReimbursed = num(reimbursedResult[0]?.total);
      const owedToAccountant = num(unreimbursedResult[0]?.total);
      const unpaidExpenses = num(unpaidResult[0]?.total);

      return {
        ...computeFinanceSummary({
          cashIn,
          withdrawalsPaid,
          expensesReimbursed,
          owedToAccountant,
          unpaidExpenses,
          memberBalances: num(balancesResult[0]?.total),
          openSessionDepositLedger: num(depositsResult[0]?.total),
          openSessionExpenses: num(openSessionExpensesResult[0]?.total),
        }),
        owedBreakdown: owedBreakdownResult
          .map((r) => ({ id: r.id, name: r.name, amount: num(r.total) }))
          .filter((r) => r.amount !== 0)
          .sort((a, b) => b.amount - a.amount),
      };
    },
  );

export const financeSummaryQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "finance-summary"],
    queryFn: () => fetchFinanceSummaryFn(),
  });

// ─── Cash flow feed ───────────────────────────────────────────────────────────

export type CashFlowEntry = {
  id: string;
  at: string;
  kind: "TOPUP" | "WITHDRAWAL" | "EXPENSE" | "MANUAL_ADJUST";
  description: string;
  who: string | null;
  /** Positive = cash into the club, negative = cash out. */
  amount: number;
};

export const fetchCashFlowFn = createServerFn({ method: "GET" })
  .validator((data: { from?: string; to?: string } | undefined) => data ?? {})
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<CashFlowEntry[]> => {
    if (!session?.user.id) return [];
    if (!(await requireAdmin(session.user.id))) return [];

    const from = data.from ? new Date(data.from) : null;
    const to = data.to ? new Date(data.to) : null;

    const ledgerFilters = [inArray(ledger.type, ["TOPUP", "MANUAL_ADJUST"] as const)];
    if (from) ledgerFilters.push(gte(ledger.createdAt, from));
    if (to) ledgerFilters.push(lte(ledger.createdAt, to));

    const withdrawalFilters = [eq(withdrawalRequests.status, "CONFIRMED")];
    if (from) withdrawalFilters.push(gte(withdrawalRequests.resolvedAt, from));
    if (to) withdrawalFilters.push(lte(withdrawalRequests.resolvedAt, to));

    const expenseFilters = [eq(expenses.isDeleted, false), isNotNull(expenses.paidAt)];
    if (from) expenseFilters.push(gte(expenses.paidAt, from));
    if (to) expenseFilters.push(lte(expenses.paidAt, to));

    const [ledgerRows, withdrawalRows, expenseRows] = await Promise.all([
      db.query.ledger.findMany({
        where: and(...ledgerFilters),
        orderBy: [desc(ledger.createdAt)],
        with: { user: true },
      }),
      db.query.withdrawalRequests.findMany({
        where: and(...withdrawalFilters),
        orderBy: [desc(withdrawalRequests.resolvedAt)],
        with: { user: true },
      }),
      db.query.expenses.findMany({
        where: and(...expenseFilters),
        orderBy: [desc(expenses.paidAt)],
        with: { session: true, paidBy: true },
      }),
    ]);

    const entries: CashFlowEntry[] = [
      ...ledgerRows.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        kind: row.type === "TOPUP" ? ("TOPUP" as const) : ("MANUAL_ADJUST" as const),
        description: row.type === "TOPUP" ? "Top-up confirmed" : (row.note ?? "Manual adjustment"),
        who: row.user.name,
        amount: parseFloat(row.amount),
      })),
      ...withdrawalRows.map((row) => ({
        id: row.id,
        at: (row.resolvedAt ?? row.createdAt).toISOString(),
        kind: "WITHDRAWAL" as const,
        description: `Withdrawal paid (${row.paymentMethod ?? "—"})`,
        who: row.user.name,
        amount: -parseFloat(row.amount),
      })),
      ...expenseRows.map((row) => ({
        id: row.id,
        at: (row.paidAt ?? row.createdAt).toISOString(),
        kind: "EXPENSE" as const,
        description: expenseLabel(row.category, row.note, row.session?.startTime ?? null),
        who: row.paidBy?.name ?? null,
        amount: -parseFloat(row.amount),
      })),
    ];

    return entries.sort((a, b) => b.at.localeCompare(a.at));
  });

export const cashFlowQueryOptions = (range: { from?: string; to?: string } = {}) =>
  queryOptions({
    queryKey: ["admin", "cash-flow", range],
    queryFn: () => fetchCashFlowFn({ data: range }),
  });
