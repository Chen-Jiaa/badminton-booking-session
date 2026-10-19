import { createMiddleware } from "@tanstack/react-start";
import { jwtVerify, createRemoteJWKSet } from "jose";

export type Session = {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
} | null;

// Built lazily, never at module scope. This module IS reachable from the client
// bundle — server functions reference `sessionMiddleware` in their middleware
// chain, and that reference survives the server-code stripping. `process.env` is
// empty in the browser, so constructing this URL eagerly throws `Invalid URL`
// during module evaluation and kills the client entry before React hydrates.
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJWKS() {
  jwks ??= createRemoteJWKSet(
    new URL(`${process.env.VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  );
  return jwks;
}

// Playwright signs its own HS256 tokens with E2E_AUTH_SECRET (see e2e/fixtures.ts) so
// tests can log in against the local test DB without a real Supabase. Never in production.
function getE2ESecret() {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret || process.env.NODE_ENV === "production") return undefined;
  return new TextEncoder().encode(secret);
}

/** Verifies a Supabase access token. Returns null when missing, expired or invalid. */
export async function verifyAccessToken(accessToken: string | undefined): Promise<Session> {
  if (!accessToken) return null;

  try {
    const e2eSecret = getE2ESecret();
    const { payload } = e2eSecret
      ? await jwtVerify(accessToken, e2eSecret, { algorithms: ["HS256"] })
      : await jwtVerify(accessToken, getJWKS());
    const meta = (payload.user_metadata ?? {}) as Record<string, string>;
    return {
      user: {
        id: payload.sub!,
        email: payload.email as string | undefined,
        name: meta.full_name,
        image: meta.avatar_url,
      },
    };
  } catch {
    // expired or invalid token — treat as unauthenticated
    return null;
  }
}

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

/** Shared cookie options so the middleware refresh path and the login handler stay in sync. */
export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  // Dynamic import keeps `@tanstack/react-start/server` out of the client bundle —
  // this module is reachable from client code via `sessionMiddleware` (see getJWKS note).
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie("sb-access-token", accessToken, authCookieOptions(ACCESS_TOKEN_MAX_AGE));
  setCookie("sb-refresh-token", refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE));
}

/**
 * Exchanges a refresh token for a fresh Supabase session, rotates the cookies and
 * returns the session. The Supabase JWT in `sb-access-token` expires after ~1 hour;
 * without this path the user is silently signed out mid-session even though the
 * cookie itself lives for days.
 */
async function refreshSession(refreshToken: string): Promise<Session> {
  // Dynamic import keeps the Supabase client out of the client bundle — this
  // module is reachable from client code (see getJWKS note above).
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;

  await setAuthCookies(data.session.access_token, data.session.refresh_token);
  return verifyAccessToken(data.session.access_token);
}

export const sessionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getCookie } = await import("@tanstack/react-start/server");
  let session = await verifyAccessToken(getCookie("sb-access-token"));

  if (!session) {
    const refreshToken = getCookie("sb-refresh-token");
    if (refreshToken) session = await refreshSession(refreshToken);
  }

  return next({ context: { session } });
});
