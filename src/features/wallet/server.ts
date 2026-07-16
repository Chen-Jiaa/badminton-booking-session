import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { ledger, users, topUpRequests } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";

export const fetchWalletFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

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

    const timeline: (LedgerItem | TopUpItem)[] = [
      ...entries.map((e) => ({ kind: "ledger" as const, createdAt: e.createdAt, data: e })),
      ...nonConfirmedTopUps.map((r) => ({
        kind: "topup" as const,
        createdAt: r.createdAt,
        data: r,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      balance: user?.balance ?? "0",
      timeline,
    };
  });

export const walletQueryOptions = () =>
  queryOptions({
    queryKey: ["wallet"],
    queryFn: () => fetchWalletFn(),
  });
