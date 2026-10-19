// `pnpm shot <path>... [--as <user>] [--full] [--desktop] [--hires] [--reseed] [--name <file>]`
//
// Screenshots pages of the `pnpm dev:test` server as a seeded user, on a phone, and
// saves them to `.context/shots/`. Prints each saved path. Shots are at CSS-pixel size
// (~412px wide), a fraction of the tokens of device pixels; `--hires` for full resolution.
//   pnpm shot /sessions /wallet --as player
//   pnpm shot /sessions/e2efull --as admin --full
//   pnpm shot /admin/sessions --as admin --reseed   # back to a fresh seed first
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { accessTokenFor, waitForHydration } from "../e2e/browser";
import { truncateTestDb } from "../e2e/db";
import { CONTEXT_OPTIONS } from "../e2e/device";
import { DEV_TEST_URL } from "../e2e/env";
import { SEED_USERS, seed, type SeedUser } from "../e2e/seed";

const OUT_DIR = ".context/shots";

function parseArgs(argv: string[]) {
  const paths: string[] = [];
  const opts = {
    as: undefined as SeedUser | undefined,
    full: false,
    desktop: false,
    hires: false,
    reseed: false,
    name: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--as") opts.as = argv[++i] as SeedUser;
    else if (arg === "--name") opts.name = argv[++i];
    else if (arg === "--full") opts.full = true;
    else if (arg === "--desktop") opts.desktop = true;
    else if (arg === "--hires") opts.hires = true;
    else if (arg === "--reseed") opts.reseed = true;
    else paths.push(arg);
  }
  if (opts.as && !(opts.as in SEED_USERS)) {
    throw new Error(`--as must be one of: ${Object.keys(SEED_USERS).join(", ")}`);
  }
  return { paths: paths.length ? paths : ["/"], ...opts };
}

/** `/sessions/e2e-full` → `sessions-e2e-full`. */
function slug(path: string) {
  return path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const up = await fetch(DEV_TEST_URL).catch(() => null);
  if (!up) throw new Error(`Nothing on ${DEV_TEST_URL}. Start it first: pnpm dev:test`);

  if (args.reseed) {
    await truncateTestDb();
    await seed();
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...(args.desktop ? devices["Desktop Chrome"] : CONTEXT_OPTIONS),
      baseURL: DEV_TEST_URL,
      timezoneId: "Asia/Kuala_Lumpur",
      reducedMotion: "reduce",
    });
    // Skip the embedded Google Map and other outside requests
    await context.route(
      (url) => url.origin !== DEV_TEST_URL,
      (route) => route.abort(),
    );
    if (args.as) {
      await context.addCookies([
        { name: "sb-access-token", value: await accessTokenFor(args.as), url: DEV_TEST_URL },
      ]);
    }

    const page = await context.newPage();
    for (let i = 0; i < args.paths.length; i++) {
      const path = args.paths[i];
      const response = await page.goto(path);
      // Error pages may never hydrate: still capture them, they're what you want to see
      await waitForHydration(page).catch(() =>
        console.warn(`${path}: not hydrated after 30s (HTTP ${response?.status()})`),
      );
      const base = args.name
        ? `${args.name}${args.paths.length > 1 ? `-${i + 1}` : ""}`
        : slug(path);
      const file = `${OUT_DIR}/${base}${args.as ? `-${args.as}` : ""}.png`;
      await page.screenshot({
        path: file,
        fullPage: args.full,
        scale: args.hires ? "device" : "css",
      });
      console.log(file);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
