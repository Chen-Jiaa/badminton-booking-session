import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { uploadReceipt } from "@/lib/supabase";

// Server route — multipart binary data cannot be handled by a server function.
// Called by TopUpForm via fetch('/api/upload', { body: formData }).
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = getCookie("sb-access-token");
        const refreshToken = getCookie("sb-refresh-token");

        if (!accessToken) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient(
          process.env.VITE_SUPABASE_URL!,
          process.env.VITE_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false } },
        );
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        });
        if (error || !data.session) {
          return new Response("Unauthorized", { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          return new Response("No file provided", { status: 400 });
        }

        const url = await uploadReceipt(file, data.session.user.id);
        return Response.json({ url });
      },
    },
  },
});
