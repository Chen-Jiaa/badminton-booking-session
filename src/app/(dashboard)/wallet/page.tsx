import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { ledger, users, topUpRequests } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, Edit, Plus, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default async function LedgerPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const [entries, nonConfirmedTopUps] = await Promise.all([
    db.query.ledger.findMany({
      where: eq(ledger.userId, session.user.id),
      orderBy: [desc(ledger.createdAt)],
      limit: 50,
      with: {
        session: true,
        topUpRequest: true,
      },
    }),
    db.query.topUpRequests.findMany({
      where: and(
        eq(topUpRequests.userId, session.user.id),
        or(eq(topUpRequests.status, "PENDING"), eq(topUpRequests.status, "REJECTED")),
        eq(topUpRequests.isDeleted, false),
      ),
      orderBy: [desc(topUpRequests.createdAt)],
    }),
  ]);

  type LedgerItem = { kind: "ledger"; createdAt: Date; data: (typeof entries)[number] };
  type TopUpItem = { kind: "topup"; createdAt: Date; data: (typeof nonConfirmedTopUps)[number] };
  type TimelineItem = LedgerItem | TopUpItem;

  const timeline: TimelineItem[] = [
    ...entries.map((e) => ({ kind: "ledger" as const, createdAt: e.createdAt, data: e })),
    ...nonConfirmedTopUps.map((r) => ({ kind: "topup" as const, createdAt: r.createdAt, data: r })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const balance = parseFloat(user?.balance || "0");
  const isLowBalance = balance < 20;

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
                  balance < 0
                    ? "text-red-600"
                    : isLowBalance
                      ? "text-yellow-600"
                      : "text-green-600",
                )}
              >
                {formatCurrency(balance)}
              </p>
              {isLowBalance && (
                <p className="text-sm text-red-600 mt-1">Low balance - please top up</p>
              )}
            </div>
            <Link href="/topup">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Top Up
              </Button>
            </Link>
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
