import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { and, isNotNull, lt } from "drizzle-orm";
import { deleteReceipts } from "@/lib/supabase";
import { RECEIPT_RETENTION_DAYS } from "@/features/topup/receipt";

// Server route — called daily by Vercel cron (see vercel.json). Deletes receipt
// images older than RECEIPT_RETENTION_DAYS from Storage and clears their paths.
export const Route = createFileRoute("/api/cron/cleanup-receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Without a secret configured, `Bearer undefined` would otherwise match
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const cutoff = new Date(Date.now() - RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const expired = and(
          isNotNull(topUpRequests.receiptUrl),
          lt(topUpRequests.createdAt, cutoff),
        );

        const rows = await db
          .select({ receiptUrl: topUpRequests.receiptUrl })
          .from(topUpRequests)
          .where(expired);
        if (rows.length === 0) return Response.json({ deleted: 0 });

        const paths = rows.map((r) => r.receiptUrl!);
        // Storage's bulk delete takes up to 1000 paths per call
        for (let i = 0; i < paths.length; i += 1000) {
          await deleteReceipts(paths.slice(i, i + 1000));
        }
        await db.update(topUpRequests).set({ receiptUrl: null }).where(expired);

        return Response.json({ deleted: paths.length });
      },
    },
  },
});
