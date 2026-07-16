import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { topUpRequestSchema } from "@/lib/validations";

type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "FORBIDDEN" }
  | { type: "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

export const fetchTopUpsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    return db.query.topUpRequests.findMany({
      where: and(eq(topUpRequests.userId, session.user.id), eq(topUpRequests.isDeleted, false)),
      orderBy: [desc(topUpRequests.createdAt)],
      limit: 20,
    });
  });

export const topUpsQueryOptions = () =>
  queryOptions({
    queryKey: ["topups"],
    queryFn: () => fetchTopUpsFn(),
  });

export const createTopUpFn = createServerFn({ method: "POST" })
  .validator((data: { amount: number; receiptUrl?: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = topUpRequestSchema.parse(data);

    await db.insert(topUpRequests).values({
      userId: session.user.id,
      amount: validated.amount.toFixed(2),
      receiptUrl: validated.receiptUrl,
    });

    return { type: "SUCCESS", value: undefined };
  });
