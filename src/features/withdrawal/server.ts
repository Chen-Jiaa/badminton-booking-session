import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { withdrawalRequests, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { withdrawalRequestSchema } from "@/lib/validations";

type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "BUSINESS_ERROR"; code: string };

export const fetchWithdrawalsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    return db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.userId, session.user.id),
      orderBy: [desc(withdrawalRequests.createdAt)],
      limit: 20,
    });
  });

export const withdrawalsQueryOptions = () =>
  queryOptions({
    queryKey: ["withdrawals"],
    queryFn: () => fetchWithdrawalsFn(),
  });

export const fetchSavedPaymentDetailsFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { duitnowPhone: true, savedBankName: true, savedAccountNumber: true },
    });

    return {
      duitnowPhone: user?.duitnowPhone ?? null,
      bankName: user?.savedBankName ?? null,
      accountNumber: user?.savedAccountNumber ?? null,
    };
  });

export const savedPaymentDetailsQueryOptions = () =>
  queryOptions({
    queryKey: ["saved-payment-details"],
    queryFn: () => fetchSavedPaymentDetailsFn(),
  });

export const createWithdrawalFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      amount: number;
      paymentMethod: "BANK" | "DUITNOW";
      bankName?: string;
      accountNumber?: string;
      duitnowPhone?: string;
      note?: string;
    }) => data,
  )
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = withdrawalRequestSchema.parse(data);

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || parseFloat(user.balance) < validated.amount) {
      return { type: "BUSINESS_ERROR", code: "INSUFFICIENT_BALANCE" };
    }

    const pendingWithdrawal = await db.query.withdrawalRequests.findFirst({
      where: and(
        eq(withdrawalRequests.userId, session.user.id),
        eq(withdrawalRequests.status, "PENDING"),
      ),
    });

    if (pendingWithdrawal) {
      return { type: "BUSINESS_ERROR", code: "PENDING_EXISTS" };
    }

    if (validated.paymentMethod === "DUITNOW") {
      await db
        .update(users)
        .set({ duitnowPhone: validated.duitnowPhone })
        .where(eq(users.id, session.user.id));

      await db.insert(withdrawalRequests).values({
        userId: session.user.id,
        amount: validated.amount.toFixed(2),
        paymentMethod: "DUITNOW",
        duitnowPhone: validated.duitnowPhone,
        note: validated.note,
      });
    } else {
      await db
        .update(users)
        .set({ savedBankName: validated.bankName, savedAccountNumber: validated.accountNumber })
        .where(eq(users.id, session.user.id));

      await db.insert(withdrawalRequests).values({
        userId: session.user.id,
        amount: validated.amount.toFixed(2),
        paymentMethod: "BANK",
        bankName: validated.bankName,
        accountNumber: validated.accountNumber,
        note: validated.note,
      });
    }

    return { type: "SUCCESS", value: undefined };
  });
