import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { topUpRequests } from "@/db/schema";
import { verifyAccessToken } from "@/middleware/auth";
import { requireAdmin } from "@/lib/guards";
import { signedReceiptUrl } from "@/lib/supabase";

// "View receipt" for admins: receipts are private, so this checks the role and
// redirects to a signed URL that expires a minute later. Never cache the redirect.
export const Route = createFileRoute("/api/receipts/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const session = await verifyAccessToken(getCookie("sb-access-token"));
        if (!session?.user.id) return new Response("Unauthorized", { status: 401 });
        if (!(await requireAdmin(session.user.id))) {
          return new Response("Forbidden", { status: 403 });
        }

        const request = await db.query.topUpRequests.findFirst({
          where: eq(topUpRequests.id, params.id),
          columns: { receiptUrl: true },
        });
        if (!request?.receiptUrl) {
          return new Response("Receipt not found (receipts are deleted after 2 months)", {
            status: 404,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: await signedReceiptUrl(request.receiptUrl),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
