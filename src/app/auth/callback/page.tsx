"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

export default function AuthCallbackPage() {
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
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        window.location.href = res.ok ? "/" : "/login?error=session_failed";
      } catch {
        window.location.href = "/login?error=auth_failed";
      }
    });

    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        subscription.unsubscribe();
        window.location.href = "/login?error=auth_failed";
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
