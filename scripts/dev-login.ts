// A tiny "sign in as ..." page for `pnpm dev:test`, on its own port so none of it ships in
// the app. Cookies ignore ports, so the cookie it sets also signs you in on the app's port.
// Only ever signs tokens with the local test secret, which the live app rejects.
import { createServer } from "node:http";
import { accessTokenFor } from "../e2e/browser";
import { DEV_LOGIN_PORT, DEV_TEST_PORT } from "../e2e/env";
import { SEED_USERS, type SeedUser } from "../e2e/seed";

const HOUR = 60 * 60;

/** `lan` also listens on the Wi-Fi so a phone can use it. */
export function startDevLogin({ lan }: { lan: boolean }) {
  const server = createServer(async (req, res) => {
    const host = (req.headers.host ?? "localhost").replace(/:\d+$/, "");
    const url = new URL(req.url ?? "/", `http://${host}`);
    const as = url.searchParams.get("as");

    if (url.pathname === "/go" && as && as in SEED_USERS) {
      const token = await accessTokenFor(as as SeedUser);
      res.writeHead(302, {
        "Set-Cookie": `sb-access-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${HOUR}`,
        Location: `http://${host}:${DEV_TEST_PORT}${url.searchParams.get("to") ?? "/profile"}`,
      });
      res.end();
      return;
    }

    const buttons = Object.entries(SEED_USERS)
      .map(([key, u]) => `<a href="/go?as=${key}"><b>${u.name}</b><small>${u.role}</small></a>`)
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in (test)</title>
<style>body{font:16px system-ui;margin:0;padding:24px;background:#f7f7f8}h1{font-size:20px}
a{display:flex;justify-content:space-between;padding:16px;margin:10px 0;border-radius:12px;background:#fff;color:#000;text-decoration:none;border:1px solid #ddd}
small{color:#888}p{color:#888;font-size:13px}</style>
<h1>Sign in as a test player</h1>${buttons}
<p>Test database only. Signs in for 1 hour, then pick again.</p>`);
  });
  server.listen(DEV_LOGIN_PORT, lan ? "0.0.0.0" : "127.0.0.1");
  return server;
}
