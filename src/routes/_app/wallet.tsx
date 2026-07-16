import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { walletQueryOptions } from "@/features/wallet/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { WithdrawalDialog } from "@/features/withdrawal/withdrawal-dialog";
import { ArrowUpCircle, ArrowDownCircle, Edit, Plus, XCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/wallet")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(walletQueryOptions()),
  component: WalletPage,
});

function WalletPage() {
  const { data } = useSuspenseQueryDeferred(walletQueryOptions());
  const { balance, timeline } = data;

  const balanceNum = parseFloat(balance);
  const isLowBalance = balanceNum < 20;

  return (
    <div className="space-y-6">
      <Card className={isLowBalance ? "border-red-200 bg-red-50" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p
                className={cn(
                  "text-3xl font-bold",
                  balanceNum < 0
                    ? "text-red-600"
                    : isLowBalance
                      ? "text-yellow-600"
                      : "text-green-600",
                )}
              >
                {formatCurrency(balanceNum)}
              </p>
              {isLowBalance && (
                <p className="text-sm text-red-600 mt-1">Low balance - please top up</p>
              )}
            </div>
            <div className="flex gap-2">
              <WithdrawalDialog balance={balanceNum} />
              <Link to="/topup">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Top Up
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Transaction History</h2>
        {timeline.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {timeline.map((item) => {
              if (item.kind === "topup") {
                const req = item.data;
                const isPending = req.status === "PENDING";
                return (
                  <Card
                    key={`topup-${req.id}`}
                    className={
                      isPending ? "border-gray-200 bg-gray-50" : "border-red-200 bg-red-50"
                    }
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${isPending ? "bg-gray-100" : "bg-red-100"}`}
                        >
                          {isPending ? (
                            <Clock className="h-4 w-4 text-gray-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {isPending ? "Top Up Pending" : "Top Up Rejected"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(req.createdAt)}
                          </p>
                          {!isPending && req.rejectReason && (
                            <p className="text-xs text-red-700 mt-0.5">
                              Reason: {req.rejectReason}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold ${isPending ? "text-gray-500" : "text-red-600"}`}
                          >
                            {formatCurrency(parseFloat(req.amount))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              const entry = item.data;
              const amount = parseFloat(entry.amount);
              const isCredit = amount > 0;
              const Icon =
                entry.type === "MANUAL_ADJUST" ? Edit : isCredit ? ArrowUpCircle : ArrowDownCircle;

              return (
                <Card key={entry.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${isCredit ? "bg-green-100" : "bg-red-100"}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${isCredit ? "text-green-600" : "text-red-600"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {entry.type === "TOPUP" && "Top Up Success"}
                          {entry.type === "SESSION_DEBIT" && "Session Fee"}
                          {entry.type === "MANUAL_ADJUST" && "Adjustment"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </p>
                        {entry.type !== "TOPUP" && entry.note && (
                          <p className="text-xs text-muted-foreground truncate">{entry.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${isCredit ? "text-green-600" : "text-red-600"}`}
                        >
                          {isCredit ? "+" : ""}
                          {formatCurrency(amount)}
                        </p>
                        {entry.type !== "TOPUP" && (
                          <p className="text-xs text-muted-foreground">
                            Bal: {formatCurrency(entry.balanceAfter)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
