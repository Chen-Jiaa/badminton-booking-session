import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { useArrivals } from "@/hooks/use-arrivals";
import { walletQueryOptions } from "@/features/wallet/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { WithdrawalDialog } from "@/features/withdrawal/withdrawal-dialog";
import { TopUpDialog } from "@/features/topup/topup-dialog";
import { ArrowUpCircle, ArrowDownCircle, Edit, XCircle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Ledger } from "@/db/schema";

const LEDGER_LABELS: Record<Ledger["type"], string> = {
  TOPUP: "Top Up Success",
  SESSION_DEBIT: "Session Fee",
  MANUAL_ADJUST: "Adjustment",
  SESSION_DEPOSIT: "Session Deposit Held",
  SESSION_REFUND: "Session Deposit Refund",
  WITHDRAWAL: "Withdrawal Paid",
};

export const Route = createFileRoute("/_app/wallet")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(walletQueryOptions()),
  component: WalletPage,
});

function WalletPage() {
  const { data } = useSuspenseQueryDeferred(walletQueryOptions());
  const { balance, pendingWithdrawalTotal, timeline } = data;
  // A request you just submitted (or one that just got approved) rises into the history
  const arrived = useArrivals(timeline.map(timelineKey));

  const balanceNum = parseFloat(balance);
  const pendingWithdrawalNum = parseFloat(pendingWithdrawalTotal);
  const availableNum = balanceNum - pendingWithdrawalNum;
  const hasPendingWithdrawal = pendingWithdrawalNum > 0;
  const isNegative = balanceNum < 0;
  const isLowBalance = !isNegative && balanceNum < 20;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-4xl font-semibold tabular-nums tracking-tight",
              isNegative ? "text-destructive" : "text-foreground",
            )}
          >
            {formatCurrency(balanceNum)}
          </p>
          {hasPendingWithdrawal && (
            <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
              {formatCurrency(pendingWithdrawalNum)} on hold for withdrawal ·{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(availableNum)} available
              </span>
            </p>
          )}
          {isLowBalance && !hasPendingWithdrawal && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Running low — top up to keep playing
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <WithdrawalDialog balance={balanceNum} className="h-10 w-full" />
            <TopUpDialog className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Transaction History</h2>
        {timeline.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-none">
            <div className="divide-y divide-border">
              {timeline.map((item) => {
                if (item.kind === "topup") {
                  const req = item.data;
                  const isPending = req.status === "PENDING";
                  return (
                    <TransactionRow
                      key={timelineKey(item)}
                      className={arrived.has(timelineKey(item)) ? "rise-in" : undefined}
                      icon={isPending ? Clock : XCircle}
                      tone={isPending ? "pending" : "rejected"}
                      title={isPending ? "Top Up Pending" : "Top Up Rejected"}
                      subtitle={formatDateTime(req.createdAt)}
                      note={!isPending && req.rejectReason ? `Reason: ${req.rejectReason}` : undefined}
                      amount={formatCurrency(parseFloat(req.amount))}
                    />
                  );
                }

                if (item.kind === "withdrawal") {
                  const req = item.data;
                  const isPending = req.status === "PENDING";
                  return (
                    <TransactionRow
                      key={timelineKey(item)}
                      className={arrived.has(timelineKey(item)) ? "rise-in" : undefined}
                      icon={isPending ? Clock : XCircle}
                      tone={isPending ? "pending" : "rejected"}
                      title={isPending ? "Withdrawal Pending" : "Withdrawal Rejected"}
                      subtitle={formatDateTime(req.createdAt)}
                      note={!isPending && req.rejectReason ? `Reason: ${req.rejectReason}` : undefined}
                      amount={`-${formatCurrency(parseFloat(req.amount))}`}
                    />
                  );
                }

                const entry = item.data;
                const amount = parseFloat(entry.amount);
                const isCredit = amount > 0;
                const Icon =
                  entry.type === "MANUAL_ADJUST" ? Edit : isCredit ? ArrowUpCircle : ArrowDownCircle;

                return (
                  <TransactionRow
                    key={timelineKey(item)}
                    className={arrived.has(timelineKey(item)) ? "rise-in" : undefined}
                    icon={Icon}
                    tone={isCredit ? "credit" : "debit"}
                    title={LEDGER_LABELS[entry.type as Ledger["type"]]}
                    subtitle={formatDateTime(entry.createdAt)}
                    note={entry.type !== "TOPUP" && entry.note ? entry.note : undefined}
                    amount={`${isCredit ? "+" : ""}${formatCurrency(amount)}`}
                    balanceAfter={
                      entry.type !== "TOPUP"
                        ? `Bal ${formatCurrency(entry.balanceAfter)}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function timelineKey(item: { kind: string; data: { id: string } }) {
  return `${item.kind}-${item.data.id}`;
}

// Status tone drives the icon chip (the at-a-glance status cue) and the amount.
// Hues follow the app's badge conventions: green = success/credit,
// amber = warning/pending, red = error/rejected. Amount colors are chosen for
// AA contrast on white; pending/rejected amounts stay neutral (amber text can't
// pass), leaning on the chip + strike-through instead so color is never the only cue.
type TransactionTone = "credit" | "debit" | "pending" | "rejected";

const TONE: Record<TransactionTone, { chip: string; icon: string; amount: string }> = {
  credit: { chip: "bg-success-soft", icon: "text-success", amount: "text-success" },
  debit: { chip: "bg-muted", icon: "text-muted-foreground", amount: "text-foreground" },
  pending: { chip: "bg-warning-soft", icon: "text-warning", amount: "text-muted-foreground" },
  rejected: {
    chip: "bg-danger-soft",
    icon: "text-danger",
    amount: "text-muted-foreground line-through",
  },
};

function TransactionRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  note,
  amount,
  balanceAfter,
  className,
}: {
  icon: LucideIcon;
  tone: TransactionTone;
  title: string;
  subtitle: string;
  note?: string;
  amount: string;
  balanceAfter?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          t.chip,
        )}
      >
        <Icon className={cn("h-4 w-4", t.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-medium tabular-nums", t.amount)}>{amount}</p>
        {balanceAfter && (
          <p className="text-xs text-muted-foreground tabular-nums">{balanceAfter}</p>
        )}
      </div>
    </div>
  );
}
