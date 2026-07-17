import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { deleteCookie, setCookie } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { users, topUpRequests } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";

export const createSessionFn = createServerFn({ method: "POST" })
  .validator((data: { access_token: string; refresh_token?: string }) => data)
  .handler(async ({ data }) => {
    const { access_token, refresh_token } = data;

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
    );
    const { data: authData, error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? "",
    });

    if (error || !authData.session) {
      throw new Error("Auth failed");
    }

    const { session } = authData;
    const supabaseUser = session.user;
    const googleImage =
      supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null;

    let dbUser = await db.query.users.findFirst({
      where: eq(users.id, supabaseUser.id),
    });

    if (!dbUser) {
      const [newUser] = await db
        .insert(users)
        .values({
          id: supabaseUser.id,
          name:
            supabaseUser.user_metadata?.full_name ||
            supabaseUser.user_metadata?.name ||
            supabaseUser.email?.split("@")[0] ||
            "User",
          email: supabaseUser.email,
          image: googleImage,
        })
        .returning();
      dbUser = newUser;
    } else if (googleImage && dbUser.image !== googleImage) {
      const [updated] = await db
        .update(users)
        .set({ image: googleImage })
        .where(eq(users.id, supabaseUser.id))
        .returning();
      dbUser = updated;
    }

    setCookie("sb-access-token", session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    setCookie("sb-refresh-token", session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return { success: true };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie("sb-access-token");
  deleteCookie("sb-refresh-token");
});

export const fetchCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true, balance: true },
    });

    let pendingTopupsCount = 0;
    if (dbUser?.role === "ADMIN") {
      const [result] = await db
        .select({ count: count() })
        .from(topUpRequests)
        .where(eq(topUpRequests.status, "PENDING"));
      pendingTopupsCount = result?.count ?? 0;
    }

    return {
      ...session.user,
      role: dbUser?.role ?? ("PLAYER" as const),
      balance: dbUser?.balance ?? "0",
      pendingTopupsCount,
    };
  });

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ["current-user"],
    queryFn: () => fetchCurrentUserFn(),
  });
