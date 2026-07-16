import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { and, isNotNull, lt } from "drizzle-orm";
import { deleteReceipts, receiptUrlToPath } from "@/lib/supabase";

// Server route — called by Vercel cron (see vercel.json).
// Deletes old receipt images from Supabase Storage and clears their URLs.
export const Route = createFileRoute("/api/cron/cleanup-receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const rows = await db
          .select({ id: topUpRequests.id, receiptUrl: topUpRequests.receiptUrl })
          .from(topUpRequests)
          .where(
            and(isNotNull(topUpRequests.receiptUrl), lt(topUpRequests.createdAt, threeMonthsAgo)),
          );

        if (rows.length === 0) {
          return Response.json({ deleted: 0 });
        }

        const paths = rows
          .map((r) => receiptUrlToPath(r.receiptUrl!))
          .filter((p): p is string => p !== null);

        await deleteReceipts(paths);

        await db
          .update(topUpRequests)
          .set({ receiptUrl: null })
          .where(
            and(isNotNull(topUpRequests.receiptUrl), lt(topUpRequests.createdAt, threeMonthsAgo)),
          );

        return Response.json({ deleted: paths.length });
      },
    },
  },
});
