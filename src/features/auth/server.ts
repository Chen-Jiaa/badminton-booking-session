import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { users, topUpRequests, withdrawalRequests, attendances } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { countMatchesWaitingOn } from "@/features/matches/queries";
import { sessionMiddleware, setAuthCookies } from "@/middleware/auth";

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

    await setAuthCookies(session.access_token, session.refresh_token);

    return { success: true };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  deleteCookie("sb-access-token");
  deleteCookie("sb-refresh-token");
});

export const fetchCurrentUserFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    // Runs on every page load, so don't make the match count wait on the user row
    const [dbUser, pendingMatches] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { role: true, balance: true, name: true, image: true },
      }),
      countMatchesWaitingOn(session.user.id),
    ]);

    let pendingTopupsCount = 0;
    let pendingWithdrawalsCount = 0;
    let pendingLateCancelsCount = 0;
    if (dbUser?.role === "ADMIN") {
      const [topupResult, withdrawalResult, lateCancelResult] = await Promise.all([
        db
          .select({ count: count() })
          .from(topUpRequests)
          .where(eq(topUpRequests.status, "PENDING")),
        db
          .select({ count: count() })
          .from(withdrawalRequests)
          .where(eq(withdrawalRequests.status, "PENDING")),
        db
          .select({ count: count() })
          .from(attendances)
          .where(eq(attendances.lateCancelStatus, "PENDING")),
      ]);
      pendingTopupsCount = topupResult[0]?.count ?? 0;
      pendingWithdrawalsCount = withdrawalResult[0]?.count ?? 0;
      pendingLateCancelsCount = lateCancelResult[0]?.count ?? 0;
    }

    return {
      ...session.user,
      role: dbUser?.role ?? ("PLAYER" as const),
      balance: dbUser?.balance ?? "0",
      name: dbUser?.name ?? null,
      image: dbUser?.image ?? null,
      pendingTopupsCount,
      pendingWithdrawalsCount,
      pendingLateCancelsCount,
      // Matches this player still has to accept or confirm, and a session to jump to
      pendingMatchesCount: pendingMatches.count,
      pendingMatchSessionId: pendingMatches.sessionId,
    };
  });

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ["current-user"],
    queryFn: () => fetchCurrentUserFn(),
    staleTime: 5 * 60 * 1000, // balance/role changes only after explicit actions that already invalidate this
  });
