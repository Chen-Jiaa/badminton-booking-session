import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createSessionSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allSessions = await db.query.sessions.findMany({
      orderBy: [desc(sessions.startTime)],
      with: { attendances: { with: { user: true } } },
    });

    return NextResponse.json(allSessions);
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const validated = createSessionSchema.parse(body);

    const [newSession] = await db.insert(sessions).values({
      startTime: new Date(validated.startTime),
      endTime: new Date(validated.endTime),
      courts: validated.courts,
      costPerCourt: validated.costPerCourt.toFixed(2),
      location: validated.location || null,
      locationMapUrl: validated.locationMapUrl || null,
      courtNumbers: validated.courtNumbers || null,
      maxPlayers: validated.maxPlayers,
      minBalance: validated.minBalance.toFixed(2),
      rsvpDeadline: validated.rsvpDeadline ? new Date(validated.rsvpDeadline) : null,
      note: validated.note,
      createdById: session.user.id,
    }).returning();

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
