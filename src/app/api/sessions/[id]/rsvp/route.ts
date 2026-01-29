import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";
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
