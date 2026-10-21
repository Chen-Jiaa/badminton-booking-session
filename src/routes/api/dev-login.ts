import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { asc, eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authCookieOptions } from "@/middleware/auth";

// Local-only sign-in for clicking around `pnpm dev:test`: lists the people in the
// database; picking one sets the same test token cookie Playwright uses. 404s unless
// E2E_AUTH_SECRET is set and NODE_ENV isn't production, exactly like the middleware's
// test-token path, so it does nothing on Vercel.
const WEEK = 60 * 60 * 24 * 7;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const Route = createFileRoute("/api/dev-login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.E2E_AUTH_SECRET;
        if (!secret || process.env.NODE_ENV === "production") {
          return new Response("Not found", { status: 404 });
        }

        const as = new URL(request.url).searchParams.get("as");
        if (as) {
          const user = await db.query.users.findFirst({ where: eq(users.id, as) });
          if (!user) return new Response("No such user", { status: 404 });

          const token = await new SignJWT({
            email: user.email,
            user_metadata: { full_name: user.name },
          })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id)
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(new TextEncoder().encode(secret));
          setCookie("sb-access-token", token, authCookieOptions(WEEK));
          return new Response(null, { status: 302, headers: { Location: "/sessions" } });
        }

        const people = await db.query.users.findMany({
          where: eq(users.isGuest, false),
          orderBy: [asc(users.role), asc(users.name)],
        });
        const rows = people
          .map(
            (u) =>
              `<a href="?as=${encodeURIComponent(u.id)}"><b>${escapeHtml(u.name)}</b><span>${u.role}</span></a>`,
          )
          .join("");
        const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dev login</title>
<style>body{font:16px Inter,system-ui,sans-serif;margin:0;padding:16px;max-width:480px}h1{font-size:18px}p{color:#666;font-size:14px}
a{display:flex;justify-content:space-between;padding:14px 12px;margin-top:8px;border:1px solid #ddd;border-radius:10px;color:#000;text-decoration:none}span{color:#c026a3;font-size:13px}</style>
<h1>Dev login</h1><p>Local test database only. Pick who to sign in as.</p>${rows}`;
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
