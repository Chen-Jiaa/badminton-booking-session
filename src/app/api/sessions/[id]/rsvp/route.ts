import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { attendances, sessions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { rsvpSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = rsvpSchema.parse({ ...body, sessionId: params.id });

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, validated.sessionId),
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (gameSession.status === "LOCKED") {
      return NextResponse.json({ error: "Session is locked" }, { status: 400 });
    }

    if (validated.status === "YES" || validated.status === "WAITLIST") {
      const now = new Date();
      if (gameSession.rsvpDeadline && now >= gameSession.rsvpDeadline) {
        return NextResponse.json(
          { error: "RSVP deadline has passed" },
          { status: 400 }
        );
      }
      if (now >= gameSession.startTime) {
        return NextResponse.json(
          { error: "RSVPs are closed — the session has already started" },
          { status: 400 }
        );
      }
    }

    if (validated.status === "YES") {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      const balance = parseFloat(user?.balance ?? "0");
      const threshold = parseFloat(gameSession.minBalance);

      if (balance < threshold) {
        return NextResponse.json(
          {
            error: `Insufficient balance. You need at least RM${threshold.toFixed(2)} to join. Current balance: RM${balance.toFixed(2)}`,
            code: "INSUFFICIENT_BALANCE",
          },
          { status: 400 }
        );
      }
    }

    const existing = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.sessionId, validated.sessionId),
        eq(attendances.userId, session.user.id)
      ),
    });

    if (existing) {
      await db.update(attendances)
        .set({ status: validated.status, updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));
    } else {
      await db.insert(attendances).values({
        sessionId: validated.sessionId,
        userId: session.user.id,
        status: validated.status,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RSVP error:", error);
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
  }
}
