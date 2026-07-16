import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSupabaseClient } from "@/features/auth/client";
import { createSessionFn } from "@/features/auth/server";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const supabase = getSupabaseClient();
    let handled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (handled) return;
      if (event !== "SIGNED_IN" || !session) return;

      handled = true;
      subscription.unsubscribe();

      try {
        await createSessionFn({
          data: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
        });
        navigate({ to: "/" });
      } catch {
        navigate({ to: "/login", search: { error: "session_failed" } });
      }
    });

    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        subscription.unsubscribe();
        navigate({ to: "/login", search: { error: "auth_failed" } });
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
