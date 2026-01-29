import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { ledger, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, Edit } from "lucide-react";

export default async function LedgerPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const entries = await db.query.ledger.findMany({
    where: eq(ledger.userId, session.user.id),
    orderBy: [desc(ledger.createdAt)],
    limit: 50,
    with: {
      session: true,
      topUpRequest: true,
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${parseFloat(user?.balance || "0") < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(user?.balance || "0")}
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Transaction History</h2>
        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No transactions yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const amount = parseFloat(entry.amount);
              const isCredit = amount > 0;
              const Icon = entry.type === "MANUAL_ADJUST" ? Edit : isCredit ? ArrowUpCircle : ArrowDownCircle;

              return (
                <Card key={entry.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isCredit ? "bg-green-100" : "bg-red-100"}`}>
                        <Icon className={`h-4 w-4 ${isCredit ? "text-green-600" : "text-red-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {entry.type === "TOPUP" && "Top Up"}
                            {entry.type === "SESSION_DEBIT" && "Session Fee"}
                            {entry.type === "MANUAL_ADJUST" && "Adjustment"}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {entry.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </p>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground truncate">{entry.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                          {isCredit ? "+" : ""}{formatCurrency(amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bal: {formatCurrency(entry.balanceAfter)}
                        </p>
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
