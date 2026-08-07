import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { adminTopUpsQueryOptions, fetchAdminTopUpsFn } from "@/features/admin/server";
import {
  adminWithdrawalsQueryOptions,
  fetchAdminWithdrawalsFn,
} from "@/features/withdrawal/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopUpActions } from "@/features/admin/topup-actions";
import { WithdrawalActions } from "@/features/finance/withdrawal-actions";

export const Route = createFileRoute("/_console/admin/topups")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(adminTopUpsQueryOptions()),
      queryClient.ensureQueryData(adminWithdrawalsQueryOptions()),
    ]),
  component: AdminTransactionsPage,
});

type TopUp = Awaited<ReturnType<typeof fetchAdminTopUpsFn>>["pending"][number];
type Withdrawal = Awaited<ReturnType<typeof fetchAdminWithdrawalsFn>>["pending"][number];

type PendingItem =
  | { kind: "topup"; createdAt: Date; data: TopUp }
  | { kind: "withdrawal"; createdAt: Date; data: Withdrawal };

function AdminTransactionsPage() {
  const { data: topups } = useSuspenseQueryDeferred(adminTopUpsQueryOptions());
  const { data: withdrawals } = useSuspenseQueryDeferred(adminWithdrawalsQueryOptions());

  const pending: PendingItem[] = [
    ...topups.pending.map((t) => ({ kind: "topup" as const, createdAt: t.createdAt, data: t })),
    ...withdrawals.pending.map((w) => ({
      kind: "withdrawal" as const,
      createdAt: w.createdAt,
      data: w,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const recent: PendingItem[] = [
    ...topups.recent.map((t) => ({ kind: "topup" as const, createdAt: t.createdAt, data: t })),
    ...withdrawals.recent.map((w) => ({
      kind: "withdrawal" as const,
      createdAt: w.createdAt,
      data: w,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Pending Transactions</h1>
        <p className="text-sm text-muted-foreground">{pending.length} awaiting review</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="pending" className="flex-1">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending requests
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map((item) =>
                item.kind === "topup" ? (
                  <TopUpCard key={`topup-${item.data.id}`} req={item.data} />
                ) : (
                  <WithdrawalCard key={`withdrawal-${item.data.id}`} req={item.data} />
                ),
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="max-w-2xl space-y-2">
            {recent.map((item) => {
              const req = item.data;
              const isTopUp = item.kind === "topup";
              return (
                <Card key={`${item.kind}-${req.id}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{req.user.name}</p>
                          <Badge variant="outline">{isTopUp ? "Top-up" : "Withdrawal"}</Badge>
                        </div>
                        <p className="text-sm">
                          {isTopUp ? "" : "-"}
                          {formatCurrency(req.amount)}
                        </p>
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
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TopUpCard({ req }: { req: TopUp }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{req.user.name}</p>
              <Badge variant="outline">Top-up</Badge>
            </div>
            <p className="text-2xl font-bold text-brand-foreground">
              {formatCurrency(req.amount)}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(req.createdAt)}</p>
          </div>
          {req.receiptUrl && (
            <a
              href={req.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-foreground underline"
            >
              View Receipt
            </a>
          )}
        </div>
        <TopUpActions requestId={req.id} />
      </CardContent>
    </Card>
  );
}

function WithdrawalCard({ req }: { req: Withdrawal }) {
  const payTo =
    req.paymentMethod === "DUITNOW"
      ? `DuitNow · ${req.duitnowPhone ?? "—"}`
      : `${req.bankName ?? "Bank"} · ${req.accountNumber ?? "—"}`;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{req.user.name}</p>
            <Badge variant="outline">Withdrawal</Badge>
          </div>
          <p className="text-2xl font-bold text-destructive">-{formatCurrency(req.amount)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(req.createdAt)}</p>
          <p className="mt-2 text-sm">{payTo}</p>
          {req.note && <p className="mt-0.5 text-xs text-muted-foreground">{req.note}</p>}
        </div>
        <WithdrawalActions requestId={req.id} />
      </CardContent>
    </Card>
  );
}
