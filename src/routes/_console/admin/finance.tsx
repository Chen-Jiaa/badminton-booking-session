import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Download } from "lucide-react";
import {
  cashFlowQueryOptions,
  expensesQueryOptions,
  financeSummaryQueryOptions,
  type FinanceSummary,
  type OwedToPayer,
} from "@/features/finance/server";
import { adminWithdrawalsQueryOptions } from "@/features/withdrawal/server";
import { adminTopUpsQueryOptions } from "@/features/admin/server";
import { EXPENSE_CATEGORY_LABELS, expenseStatus } from "@/features/finance/format";
import { AddExpenseButton } from "@/features/finance/expense-form";
import { ExpenseActions } from "@/features/finance/expense-actions";
import { WithdrawalActions } from "@/features/finance/withdrawal-actions";

export const Route = createFileRoute("/_console/admin/finance")({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(expensesQueryOptions());
    queryClient.prefetchQuery(adminWithdrawalsQueryOptions());
    queryClient.prefetchQuery(adminTopUpsQueryOptions());
    queryClient.prefetchQuery(cashFlowQueryOptions());
    return queryClient.ensureQueryData(financeSummaryQueryOptions());
  },
  component: FinancePage,
});

type Summary = FinanceSummary & { owedBreakdown: OwedToPayer[] };

function FinancePage() {
  const { data: summary } = useSuspenseQueryDeferred(financeSummaryQueryOptions());

  return (
    <div className="space-y-5">
      <h1 className="text-xl lg:text-2xl font-bold">Finance</h1>

      {summary && <SummarySection summary={summary} />}

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="w-full lg:w-auto lg:inline-flex">
          {[
            ["expenses", "Expenses"],
            ["topups", "Top-ups"],
            ["withdrawals", "Payouts"],
            ["cashflow", "Cash flow"],
          ].map(([v, label]) => (
            <TabsTrigger key={v} value={v} className="flex-1 lg:flex-none lg:px-6">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="topups" className="mt-4">
          <TopUpsTab />
        </TabsContent>
        <TabsContent value="withdrawals" className="mt-4">
          <WithdrawalsTab />
        </TabsContent>
        <TabsContent value="cashflow" className="mt-4">
          <CashFlowTab />
        </TabsContent>
      </Tabs>

      <ExportSection />
    </div>
  );
}

/* ── Summary ──────────────────────────────────────────────────────────────── */

function SummarySection({ summary }: { summary: Summary }) {
  // `trueSurplus` ignores money already earmarked for recovery at lock, so it
  // only goes red when the club is genuinely short.
  const short = summary.trueSurplus < 0;
  const awaiting = summary.recoverableAtLock > 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {short ? "Shortfall" : "Surplus"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={`text-3xl font-bold ${short ? "text-danger" : "text-success"}`}>
              {formatCurrency(summary.trueSurplus)}
            </p>
            {awaiting ? (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(summary.surplus)} on paper, of which{" "}
                <span className="font-medium">{formatCurrency(summary.recoverableAtLock)}</span> is
                spend on open sessions that players get charged for at lock.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {short
                  ? "Cash on hand doesn't cover what's owed."
                  : "Cash on hand covers everything owed, with this much spare."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
          <StatCard label="Club cash" value={summary.clubCash} />
          <StatCard label="Owed to members" value={summary.memberLiability} negative />
          <StatCard label="Owed to organisers" value={summary.owedToAccountant} negative />
          <StatCard label="Unpaid bills" value={summary.unpaidExpenses} negative />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {summary.owedBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Out of pocket — needs paying back
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {summary.owedBreakdown.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-semibold text-danger">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="px-1 py-2 text-xs text-muted-foreground space-y-1">
          <SplitRow label="Total top-ups received" value={`+${formatCurrency(summary.cashIn)}`} />
          <SplitRow
            label="Withdrawals paid out"
            value={`−${formatCurrency(summary.withdrawalsPaid)}`}
          />
          <SplitRow
            label="Expenses reimbursed"
            value={`−${formatCurrency(summary.expensesReimbursed)}`}
          />
          <SplitRow
            label="Deposits held on open sessions"
            value={formatCurrency(summary.heldDeposits)}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${negative && value > 0 ? "text-danger" : ""}`}>
          {formatCurrency(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function SplitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "CONFIRMED" || status === "REIMBURSED"
      ? "success"
      : status === "REJECTED" || status === "UNPAID"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

/** Table on desktop, cards on mobile — same data, no horizontal scrolling on a phone. */
function Responsive({ table, cards }: { table: React.ReactNode; cards: React.ReactNode }) {
  return (
    <>
      <div className="hidden lg:block">
        <Card>
          <CardContent className="p-0">{table}</CardContent>
        </Card>
      </div>
      <div className="lg:hidden space-y-3">{cards}</div>
    </>
  );
}

/* ── Expenses ─────────────────────────────────────────────────────────────── */

function ExpensesTab() {
  const { data: expenses = [] } = useQuery(expensesQueryOptions());

  if (expenses.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <AddExpenseButton />
        </div>
        <EmptyCard>No expenses recorded yet</EmptyCard>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <AddExpenseButton />
      </div>

      <Responsive
        table={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recorded</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const status = expenseStatus(e);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.note ??
                        (e.session ? `Session ${formatDateTime(e.session.startTime)}` : "—")}
                    </TableCell>
                    <TableCell>{e.paidBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ExpenseActions expenseId={e.id} status={status} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        }
        cards={expenses.map((e) => {
          const status = expenseStatus(e);
          return (
            <Card key={e.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                    </p>
                    <p className="text-2xl font-bold text-brand-foreground">
                      {formatCurrency(e.amount)}
                    </p>
                    {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                    {e.session && (
                      <p className="text-xs text-muted-foreground">
                        Session {formatDateTime(e.session.startTime)}
                      </p>
                    )}
                    {e.paidBy && (
                      <p className="text-xs text-muted-foreground">Paid by {e.paidBy.name}</p>
                    )}
                  </div>
                  <StatusBadge status={status} />
                </div>
                <ExpenseActions expenseId={e.id} status={status} />
              </CardContent>
            </Card>
          );
        })}
      />
    </div>
  );
}

/* ── Top-ups ──────────────────────────────────────────────────────────────── */

function TopUpsTab() {
  const { data } = useQuery(adminTopUpsQueryOptions());
  const rows = data?.recent ?? [];
  const pendingCount = data?.pending?.length ?? 0;

  if (rows.length === 0) return <EmptyCard>No top-up requests yet</EmptyCard>;

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {pendingCount} awaiting review — approve them on the{" "}
          <span className="font-medium">Pending Top-Ups</span> page.
        </p>
      )}

      <Responsive
        table={
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{r.user.name}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.confirmedAt ? formatDateTime(r.confirmedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.receiptUrl ? (
                      <a
                        href={`/api/receipts/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-foreground underline"
                      >
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.rejectReason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
        cards={rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.user.name}</p>
                  <p className="text-sm font-semibold">{formatCurrency(r.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                  {r.rejectReason && <p className="text-xs text-danger">{r.rejectReason}</p>}
                </div>
                <StatusBadge status={r.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      />
    </div>
  );
}

/* ── Withdrawals ──────────────────────────────────────────────────────────── */

function WithdrawalsTab() {
  const { data } = useQuery(adminWithdrawalsQueryOptions());
  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <EmptyCard>No pending payouts</EmptyCard>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-4 space-y-3">
                  <div>
                    <p className="font-semibold">{req.user.name}</p>
                    <p className="text-2xl font-bold text-brand-foreground">
                      {formatCurrency(req.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.paymentMethod === "DUITNOW"
                        ? `DuitNow ${req.duitnowPhone}`
                        : `${req.bankName} ${req.accountNumber}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(req.createdAt)}</p>
                    {req.note && <p className="text-xs text-muted-foreground">{req.note}</p>}
                  </div>
                  <WithdrawalActions requestId={req.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">History</h2>
        {recent.length === 0 ? (
          <EmptyCard>Nothing yet</EmptyCard>
        ) : (
          <Responsive
            table={
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{r.user.name}</TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </TableCell>
                      <TableCell>{r.paymentMethod ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.resolvedAt ? formatDateTime(r.resolvedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
            cards={recent.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.user.name}</p>
                      <p className="text-sm">{formatCurrency(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          />
        )}
      </div>
    </div>
  );
}

/* ── Cash flow ────────────────────────────────────────────────────────────── */

function CashFlowTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };
  const { data: entries = [] } = useQuery(cashFlowQueryOptions(range));
  const net = entries.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="lg:w-96">
          <DateRangeFields from={from} to={to} onFrom={setFrom} onTo={setTo} />
        </div>
        <Card className="lg:w-72">
          <CardContent className="py-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Net cash movement</span>
            <span className={`font-semibold ${net < 0 ? "text-danger" : "text-success"}`}>
              {formatCurrency(net)}
            </span>
          </CardContent>
        </Card>
      </div>

      {entries.length === 0 ? (
        <EmptyCard>No cash movement in this range</EmptyCard>
      ) : (
        <Responsive
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={`${e.kind}-${e.id}`}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(e.at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.kind.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{e.who ?? "—"}</TableCell>
                    <TableCell
                      className={`text-right font-semibold whitespace-nowrap ${
                        e.amount < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {e.amount < 0 ? "−" : "+"}
                      {formatCurrency(Math.abs(e.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          cards={entries.map((e) => (
            <Card key={`${e.kind}-${e.id}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.who ? `${e.who} • ` : ""}
                      {formatDateTime(e.at)}
                    </p>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      e.amount < 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {e.amount < 0 ? "−" : "+"}
                    {formatCurrency(Math.abs(e.amount))}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        />
      )}
    </div>
  );
}

/* ── Members ──────────────────────────────────────────────────────────────── */

/* ── Shared ───────────────────────────────────────────────────────────────── */

function DateRangeFields({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={`from-${from}`} className="text-xs">
          From
        </Label>
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

const DATASETS = [
  { key: "ledger", label: "Wallet ledger" },
  { key: "expenses", label: "Expenses" },
  { key: "withdrawals", label: "Payouts" },
  { key: "members", label: "Members" },
] as const;

function ExportSection() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function href(dataset: string) {
    const params = new URLSearchParams({ dataset });
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
    return `/api/admin/export?${params.toString()}`;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Export to Excel / Sheets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 lg:flex lg:items-end lg:gap-6 lg:space-y-0">
        <div className="lg:w-96 lg:shrink-0">
          <DateRangeFields from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <p className="text-xs text-muted-foreground mt-2">
            Leave dates empty to export everything. Member balances are always current.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:flex-1">
          {DATASETS.map((d) => (
            <a
              key={d.key}
              href={href(d.key)}
              download
              className="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4 text-brand-foreground" />
              {d.label}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
