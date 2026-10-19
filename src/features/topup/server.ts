import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { topUpRequests, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { topUpRequestSchema } from "@/lib/validations";
import { getAdminFcmTokens } from "@/lib/guards";
import { sendNewTopUpRequestNotification } from "@/lib/push";
import { isOwnReceiptPath } from "./receipt";

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
  .validator((data: { amount: number; receiptPath?: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = topUpRequestSchema.parse(data);
    if (validated.receiptPath && !isOwnReceiptPath(validated.receiptPath, session.user.id)) {
      return { type: "BUSINESS_ERROR", code: "Upload the receipt again" };
    }

    await db.insert(topUpRequests).values({
      userId: session.user.id,
      amount: validated.amount.toFixed(2),
      // The column predates private storage: it holds the storage path, not a URL
      receiptUrl: validated.receiptPath,
    });

    // Alert admins with push enabled. Best-effort — a notification failure must
    // never fail the request that was already saved.
    try {
      const adminTokens = await getAdminFcmTokens();
      if (adminTokens.length > 0) {
        const player = await db.query.users.findFirst({
          where: eq(users.id, session.user.id),
          columns: { name: true },
        });
        await sendNewTopUpRequestNotification(
          adminTokens,
          player?.name ?? "A player",
          validated.amount.toFixed(2),
        );
      }
    } catch (error) {
      console.error("Failed to notify admins of top-up request:", error);
    }

    return { type: "SUCCESS", value: undefined };
  });
