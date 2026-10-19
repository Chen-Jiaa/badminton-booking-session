import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { verifyAccessToken } from "@/middleware/auth";
import { uploadReceipt } from "@/lib/supabase";
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from "@/features/topup/receipt";

// Server route — multipart binary data cannot be handled by a server function.
// Called by TopUpDialog via fetch('/api/upload', { body: formData }). Returns the
// storage path, which the dialog passes on to createTopUpFn.
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await verifyAccessToken(getCookie("sb-access-token"));
        if (!session?.user.id) return new Response("Unauthorized", { status: 401 });

        // Refuse oversized bodies before reading them (a little slack for the multipart wrapper)
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_RECEIPT_BYTES + 64 * 1024) {
          return new Response("Receipt must be 2 MB or smaller", { status: 413 });
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          return new Response("No file provided", { status: 400 });
        }
        if (file.size > MAX_RECEIPT_BYTES) {
          return new Response("Receipt must be 2 MB or smaller", { status: 413 });
        }
        if (!RECEIPT_TYPES[file.type]) {
          return new Response("Receipt must be a photo (JPEG, PNG, WebP or HEIC)", { status: 415 });
        }

        const path = await uploadReceipt(file, session.user.id);
        return Response.json({ path });
      },
    },
  },
});
