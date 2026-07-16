import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { attendances, sessions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { addPlayerSchema } from "@/lib/validations";

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
    const validated = addPlayerSchema.parse(body);

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
    });

    if (!gameSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (gameSession.status === "LOCKED") {
      return NextResponse.json({ error: "Cannot add players to a locked session" }, { status: 400 });
    }

    const existing = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.sessionId, params.id),
        eq(attendances.userId, validated.userId)
      ),
    });

    if (existing) {
      await db.update(attendances)
        .set({ status: "YES", updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));
    } else {
      await db.insert(attendances).values({
        sessionId: params.id,
        userId: validated.userId,
        status: "YES",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add player error:", error);
    return NextResponse.json({ error: "Failed to add player" }, { status: 500 });
  }
}
