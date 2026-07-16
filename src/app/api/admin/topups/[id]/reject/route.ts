import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { topUpRequests, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rejectTopUpSchema } from "@/lib/validations";
import { sendTopUpRejectedNotification } from "@/lib/fcm";

export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    const body = await request.json();
    const validated = rejectTopUpSchema.parse({ ...body, requestId: params.id });

    const topUpRequest = await db.query.topUpRequests.findFirst({
      where: eq(topUpRequests.id, params.id),
      with: { user: true },
    });

    if (!topUpRequest || topUpRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await db
      .update(topUpRequests)
      .set({
        status: "REJECTED",
        rejectReason: validated.reason,
        confirmedAt: new Date(),
        confirmedBy: session.user.id,
      })
      .where(eq(topUpRequests.id, params.id));

    if (topUpRequest.user.fcmToken) {
      await sendTopUpRejectedNotification(
        topUpRequest.user.fcmToken,
        topUpRequest.amount,
        validated.reason,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reject top-up error:", error);
    return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
  }
}
