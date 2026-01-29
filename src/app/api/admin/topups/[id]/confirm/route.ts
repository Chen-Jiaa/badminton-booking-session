import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { topUpRequests, users, ledger } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendTopUpConfirmedNotification } from "@/lib/fcm";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!admin || admin.role === "PLAYER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const topUpRequest = await db.query.topUpRequests.findFirst({
      where: eq(topUpRequests.id, params.id),
      with: { user: true },
    });

    if (!topUpRequest || topUpRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const amount = parseFloat(topUpRequest.amount);
    const currentBalance = parseFloat(topUpRequest.user.balance);
    const newBalance = currentBalance + amount;
    const adminUserId = session.user.id;

    await db.transaction(async (tx) => {
      await tx.update(topUpRequests)
        .set({
          status: "CONFIRMED",
          confirmedAt: new Date(),
          confirmedBy: adminUserId,
        })
        .where(eq(topUpRequests.id, params.id));

      await tx.update(users)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(users.id, topUpRequest.userId));

      await tx.insert(ledger).values({
        userId: topUpRequest.userId,
        type: "TOPUP",
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        note: "Top-up confirmed",
        createdById: adminUserId,
        topUpRequestId: params.id,
      });
    });

    if (topUpRequest.user.fcmToken) {
      await sendTopUpConfirmedNotification(topUpRequest.user.fcmToken, amount.toFixed(2));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm top-up error:", error);
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
