import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { courts, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const PREDEFINED_COURTS = [
  "https://maps.app.goo.gl/vY5VbPZhLXwvCYru5",
  "https://maps.app.goo.gl/Vib8GgxLakwqzVxk7",
  "https://maps.app.goo.gl/U54Him1k9piY6SUv8",
  "https://maps.app.goo.gl/5zD8q2hhHk8DDcnJ6",
  "https://maps.app.goo.gl/TBmMPJGggs7bFXX88",
  "https://maps.app.goo.gl/j5LVWxuNdzDw4FKYA",
];

async function resolveMapUrlName(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const finalUrl = res.url;
    const match = finalUrl.match(/maps\/place\/([^/@?]+)/);
    if (match) {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    }
  } catch {
    // fall through
  }
  return url;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allCourts = await db.query.courts.findMany({
      orderBy: (c, { asc }) => [asc(c.createdAt)],
    });

    if (allCourts.length === 0) {
      const resolved = await Promise.all(
        PREDEFINED_COURTS.map(async (url) => ({
          name: await resolveMapUrlName(url),
          mapUrl: url,
        })),
      );
      const inserted = await db.insert(courts).values(resolved).returning();
      return NextResponse.json(inserted);
    }

    return NextResponse.json(allCourts);
  } catch (error) {
    console.error("Get courts error:", error);
    return NextResponse.json({ error: "Failed to fetch courts" }, { status: 500 });
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

    const { mapUrl } = await request.json();
    if (!mapUrl || typeof mapUrl !== "string") {
      return NextResponse.json({ error: "mapUrl is required" }, { status: 400 });
    }

    const name = await resolveMapUrlName(mapUrl);
    const [court] = await db.insert(courts).values({ name, mapUrl }).returning();
    return NextResponse.json(court, { status: 201 });
  } catch (error) {
    console.error("Create court error:", error);
    return NextResponse.json({ error: "Failed to create court" }, { status: 500 });
  }
}
