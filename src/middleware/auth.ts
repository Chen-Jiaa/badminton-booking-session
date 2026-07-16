import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

type Session = {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
} | null;

export const sessionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const accessToken = getCookie("sb-access-token");
  const refreshToken = getCookie("sb-refresh-token");
  let session: Session = null;

  if (accessToken) {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? "",
    });

    if (!error && data.session) {
      const { user } = data.session;
      session = {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name as string | undefined,
          image: user.user_metadata?.avatar_url as string | undefined,
        },
      };
    }
  }

  return next({ context: { session } });
});
