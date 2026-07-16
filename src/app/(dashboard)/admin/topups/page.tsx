import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopUpActions } from "./topup-actions";

export default async function AdminTopUpsPage() {
  const pendingRequests = await db.query.topUpRequests.findMany({
    where: and(eq(topUpRequests.status, "PENDING"), eq(topUpRequests.isDeleted, false)),
    orderBy: [desc(topUpRequests.createdAt)],
    with: { user: true },
  });

  const recentRequests = await db.query.topUpRequests.findMany({
    where: eq(topUpRequests.isDeleted, false),
    orderBy: [desc(topUpRequests.createdAt)],
    limit: 50,
    with: { user: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Top-Up Requests</h1>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending requests
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{req.user.name}</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(req.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(req.createdAt)}
                        </p>
                      </div>
                      {req.receiptUrl && (
                        <a
                          href={req.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline"
                        >
                          View Receipt
                        </a>
                      )}
                    </div>
                    <TopUpActions requestId={req.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="space-y-2">
            {recentRequests.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{req.user.name}</p>
                      <p className="text-sm">{formatCurrency(req.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(req.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        req.status === "CONFIRMED"
                          ? "success"
                          : req.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {req.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
