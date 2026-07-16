import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { courts, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: Request,
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

    await db.delete(courts).where(eq(courts.id, params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete court error:", error);
    return NextResponse.json({ error: "Failed to delete court" }, { status: 500 });
  }
}
