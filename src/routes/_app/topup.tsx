import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { topUpsQueryOptions } from "@/features/topup/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TopUpForm } from "@/features/topup/topup-form";

export const Route = createFileRoute("/_app/topup")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(topUpsQueryOptions()),
  component: TopUpPage,
});

function TopUpPage() {
  const { data: requests } = useSuspenseQueryDeferred(topUpsQueryOptions());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Request Top Up</CardTitle>
        </CardHeader>
        <CardContent>
          <TopUpForm />
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">Your Top-Up Requests</h2>
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No top-up requests yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{formatCurrency(req.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(req.createdAt)}
                      </p>
                      {req.rejectReason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {req.rejectReason}</p>
                      )}
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
        )}
      </div>
    </div>
  );
}
