import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyAccessToken } from "@/middleware/auth";
import { deleteOldAvatars, uploadAvatar } from "@/lib/supabase";
import { MAX_AVATAR_BYTES } from "@/features/profile/avatar";

// Server route (multipart can't go through a server function). The profile page sends a
// photo already cropped and shrunk in the browser; we store it and point users.image at it.
export const Route = createFileRoute("/api/avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await verifyAccessToken(getCookie("sb-access-token"));
        if (!session?.user.id) return new Response("Unauthorized", { status: 401 });

        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX_AVATAR_BYTES + 64 * 1024) {
          return new Response("Photo must be 512 KB or smaller", { status: 413 });
        }

        const file = (await request.formData()).get("file");
        if (!(file instanceof File)) return new Response("No file provided", { status: 400 });
        if (file.size > MAX_AVATAR_BYTES) {
          return new Response("Photo must be 512 KB or smaller", { status: 413 });
        }
        if (file.type !== "image/jpeg")
          return new Response("Photo must be a JPEG", { status: 415 });

        const userId = session.user.id;
        const image = await uploadAvatar(file, userId);
        await db.update(users).set({ image, updatedAt: new Date() }).where(eq(users.id, userId));
        await deleteOldAvatars(userId, image).catch(() => {}); // leftovers are harmless
        return Response.json({ image });
      },
    },
  },
});
