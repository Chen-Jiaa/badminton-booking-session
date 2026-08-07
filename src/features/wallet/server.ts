import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { ledger, users, topUpRequests, withdrawalRequests } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";

export const fetchWalletFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const [user, entries, nonConfirmedTopUps, nonConfirmedWithdrawals] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
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
      // Confirmed withdrawals already show up as ledger rows; only the pending
      // and rejected ones need to be surfaced here.
      db.query.withdrawalRequests.findMany({
        where: and(
          eq(withdrawalRequests.userId, session.user.id),
          or(
            eq(withdrawalRequests.status, "PENDING"),
            eq(withdrawalRequests.status, "REJECTED"),
          ),
        ),
        orderBy: [desc(withdrawalRequests.createdAt)],
      }),
    ]);

    type LedgerItem = { kind: "ledger"; createdAt: Date; data: (typeof entries)[number] };
    type TopUpItem = { kind: "topup"; createdAt: Date; data: (typeof nonConfirmedTopUps)[number] };
    type WithdrawalItem = {
      kind: "withdrawal";
      createdAt: Date;
      data: (typeof nonConfirmedWithdrawals)[number];
    };

    const timeline: (LedgerItem | TopUpItem | WithdrawalItem)[] = [
      ...entries.map((e) => ({ kind: "ledger" as const, createdAt: e.createdAt, data: e })),
      ...nonConfirmedTopUps.map((r) => ({
        kind: "topup" as const,
        createdAt: r.createdAt,
        data: r,
      })),
      ...nonConfirmedWithdrawals.map((r) => ({
        kind: "withdrawal" as const,
        createdAt: r.createdAt,
        data: r,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Withdrawals don't touch users.balance until confirmed, so the raw balance
    // overstates what's actually spendable. Report the amount held so the UI can
    // show a truthful "available" figure.
    const pendingWithdrawalTotal = nonConfirmedWithdrawals
      .filter((r) => r.status === "PENDING")
      .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    return {
      balance: user?.balance ?? "0",
      pendingWithdrawalTotal: pendingWithdrawalTotal.toFixed(2),
      timeline,
    };
  });

export const walletQueryOptions = () =>
  queryOptions({
    queryKey: ["wallet"],
    queryFn: () => fetchWalletFn(),
  });
