export type ExpenseStatus = "UNPAID" | "PAID" | "REIMBURSED";

/** Sortable, spreadsheet-friendly timestamp: YYYY-MM-DD HH:mm. */
export function fmtDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function expenseStatus(expense: {
  paidAt: Date | string | null;
  reimbursed: boolean;
}): ExpenseStatus {
  if (expense.reimbursed) return "REIMBURSED";
  return expense.paidAt ? "PAID" : "UNPAID";
}

export type FinanceSummary = {
  cashIn: number;
  withdrawalsPaid: number;
  expensesReimbursed: number;
  clubCash: number;
  heldDeposits: number;
  memberLiability: number;
  owedToAccountant: number;
  unpaidExpenses: number;
  surplus: number;
  /** Spend on still-open sessions that players will be charged for at lock. */
  recoverableAtLock: number;
  /** Surplus excluding spend that's already earmarked for recovery. */
  trueSurplus: number;
};

/** The raw aggregates the summary is derived from, straight out of SQL. */
export type FinanceTotals = {
  cashIn: number;
  withdrawalsPaid: number;
  expensesReimbursed: number;
  /** Paid out of pocket but not yet paid back from the club pot. */
  owedToAccountant: number;
  /** Recorded but not yet settled with the venue/vendor. */
  unpaidExpenses: number;
  /** SUM(users.balance). */
  memberBalances: number;
  /** Net of SESSION_DEPOSIT/SESSION_REFUND on still-open sessions (negative in the ledger). */
  openSessionDepositLedger: number;
  /** Expenses attached to sessions still OPEN — players haven't been charged yet. */
  openSessionExpenses: number;
};

/**
 * Derives the club's cash position.
 *
 * `surplus` only moves on real economic events. Locking a session, paying a
 * bill, and reimbursing yourself all shift money between these buckets without
 * changing the bottom line — which is what makes it a usable reconciliation check.
 */
export function computeFinanceSummary(totals: FinanceTotals): FinanceSummary {
  // Deposit rows are stored negative, refunds positive — negate to get the amount held.
  const heldDeposits = -totals.openSessionDepositLedger;

  const clubCash = totals.cashIn - totals.withdrawalsPaid - totals.expensesReimbursed;
  const memberLiability = totals.memberBalances + heldDeposits;
  const surplus =
    clubCash - memberLiability - totals.owedToAccountant - totals.unpaidExpenses;

  // The court is paid when a session is booked, but players aren't charged
  // until it's locked. That gap makes `surplus` dip negative every cycle even
  // when nothing is wrong, so report what's merely awaiting recovery too.
  const recoverableAtLock = totals.openSessionExpenses;
  const trueSurplus = surplus + recoverableAtLock;

  return {
    recoverableAtLock,
    trueSurplus,
    cashIn: totals.cashIn,
    withdrawalsPaid: totals.withdrawalsPaid,
    expensesReimbursed: totals.expensesReimbursed,
    clubCash,
    heldDeposits,
    memberLiability,
    owedToAccountant: totals.owedToAccountant,
    unpaidExpenses: totals.unpaidExpenses,
    surplus,
  };
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  COURT_RENTAL: "Court rental",
  SHUTTLES: "Shuttles",
  OTHER: "Other",
};

export function expenseLabel(
  category: "COURT_RENTAL" | "SHUTTLES" | "OTHER",
  note: string | null,
  sessionStart: Date | string | null,
): string {
  const base = EXPENSE_CATEGORY_LABELS[category] ?? category;
  if (note) return `${base} — ${note}`;
  if (sessionStart) {
    const d = typeof sessionStart === "string" ? new Date(sessionStart) : sessionStart;
    return `${base} — ${d.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`;
  }
  return base;
}
