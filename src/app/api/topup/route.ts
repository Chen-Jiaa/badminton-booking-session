import { NextResponse } from "next/server";
import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { topUpRequestSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = topUpRequestSchema.parse(body);

    const [newRequest] = await db
      .insert(topUpRequests)
      .values({
        userId: session.user.id,
        amount: validated.amount.toFixed(2),
        receiptUrl: validated.receiptUrl,
      })
      .returning();

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("Top-up request error:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
