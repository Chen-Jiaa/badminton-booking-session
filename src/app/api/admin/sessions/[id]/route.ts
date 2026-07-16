import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { sessions, attendances, ledger, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateSessionSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (gameSession.status === "LOCKED") {
      return NextResponse.json({ error: "Cannot edit a locked session" }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateSessionSchema.parse(body);

    await db
      .update(sessions)
      .set({
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        courts: validated.courts,
        costPerCourt: validated.costPerCourt.toFixed(2),
        location: validated.location || null,
        locationMapUrl: validated.locationMapUrl || null,
        courtNumbers: validated.courtNumbers || null,
        maxPlayers: validated.maxPlayers,
        minBalance: validated.minBalance.toFixed(2),
        note: validated.note || null,
        rsvpDeadline: validated.rsvpDeadline ? new Date(validated.rsvpDeadline) : null,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update session error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
      with: {
        attendances: true,
        ledgerEntries: true,
      },
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // If session is locked and has ledger entries, we need to reverse the charges
    if (gameSession.status === "LOCKED" && gameSession.ledgerEntries.length > 0) {
      // Reverse the balance deductions for each player
      for (const entry of gameSession.ledgerEntries) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, entry.userId),
        });
        if (user) {
          const newBalance = (
            parseFloat(user.balance) + Math.abs(parseFloat(entry.amount))
          ).toFixed(2);
          await db
            .update(users)
            .set({ balance: newBalance, updatedAt: new Date() })
            .where(eq(users.id, entry.userId));
        }
      }

      // Delete ledger entries
      await db.delete(ledger).where(eq(ledger.sessionId, params.id));
    }

    // Delete attendances
    await db.delete(attendances).where(eq(attendances.sessionId, params.id));

    // Delete session
    await db.delete(sessions).where(eq(sessions.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
