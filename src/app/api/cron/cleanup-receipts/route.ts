import { NextResponse } from "next/server";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { and, isNotNull, lt } from "drizzle-orm";
import { deleteReceipts, receiptUrlToPath } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const rows = await db
    .select({ id: topUpRequests.id, receiptUrl: topUpRequests.receiptUrl })
    .from(topUpRequests)
    .where(
      and(
        isNotNull(topUpRequests.receiptUrl),
        lt(topUpRequests.createdAt, threeMonthsAgo)
      )
    );

  if (rows.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const paths = rows
    .map((r) => receiptUrlToPath(r.receiptUrl!))
    .filter((p): p is string => p !== null);

  await deleteReceipts(paths);

  await db
    .update(topUpRequests)
    .set({ receiptUrl: null })
    .where(
      and(
        isNotNull(topUpRequests.receiptUrl),
        lt(topUpRequests.createdAt, threeMonthsAgo)
      )
    );

  return NextResponse.json({ deleted: paths.length });
}
