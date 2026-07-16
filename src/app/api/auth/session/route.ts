import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json();

  if (!access_token) {
    return NextResponse.json({ error: "No access token" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Config error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || "",
  });

  if (error || !data.session) {
    return NextResponse.json({ error: "Auth failed" }, { status: 401 });
  }

  const { session } = data;
  const supabaseUser = session.user;

  let dbUser = await db.query.users.findFirst({
    where: eq(users.id, supabaseUser.id),
  });

  const googleImage =
    supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null;

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

  const response = NextResponse.json({ success: true });

  response.cookies.set("sb-access-token", session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.set("sb-refresh-token", session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
