import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { sessions, attendances, users, ledger } from "@/db/schema";
import { eq } from "drizzle-orm";
import { lockSessionSchema } from "@/lib/validations";
import { sendLowBalanceNotification } from "@/lib/fcm";

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

    const body = await request.json();
    const validated = lockSessionSchema.parse({ ...body, sessionId: params.id });

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
      with: {
        attendances: {
          where: eq(attendances.status, "YES"),
          with: { user: true },
        },
      },
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const confirmedAttendees = gameSession.attendances;
    if (confirmedAttendees.length === 0) {
      return NextResponse.json({ error: "No confirmed attendees" }, { status: 400 });
    }

    const courtCost = gameSession.courts * parseFloat(gameSession.costPerCourt);
    const shuttleCost = validated.shuttleTubes * validated.costPerTube;
    const totalCost = courtCost + shuttleCost;
    const costPerPlayer = totalCost / confirmedAttendees.length;

    const adminUserId = session.user.id;

    await db.transaction(async (tx) => {
      await tx.update(sessions).set({
        shuttleTubes: validated.shuttleTubes,
        costPerTube: validated.costPerTube.toFixed(2),
        totalCost: totalCost.toFixed(2),
        costPerPlayer: costPerPlayer.toFixed(2),
        status: "LOCKED",
        updatedAt: new Date(),
      }).where(eq(sessions.id, params.id));

      for (const attendance of confirmedAttendees) {
        const user = attendance.user;
        const currentBalance = parseFloat(user.balance);
        const newBalance = currentBalance - costPerPlayer;

        await tx.update(users)
          .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
          .where(eq(users.id, user.id));

        await tx.update(attendances)
          .set({ finalCost: costPerPlayer.toFixed(2), updatedAt: new Date() })
          .where(eq(attendances.id, attendance.id));

        await tx.insert(ledger).values({
          userId: user.id,
          type: "SESSION_DEBIT",
          amount: (-costPerPlayer).toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          note: `Session fee`,
          createdById: adminUserId,
          sessionId: params.id,
        });

        if (newBalance < 20 && user.fcmToken) {
          await sendLowBalanceNotification(user.fcmToken, newBalance.toFixed(2));
        }
      }
    });

    return NextResponse.json({ success: true, costPerPlayer });
  } catch (error) {
    console.error("Lock session error:", error);
    return NextResponse.json({ error: "Failed to lock session" }, { status: 500 });
  }
}
