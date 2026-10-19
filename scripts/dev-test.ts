// `pnpm dev:test`: rebuild and seed the local test DB, then run the dev server against
// it on DEV_TEST_PORT with test sign-in enabled, so `pnpm shot` (or you) can sign in
// as any seeded user. Never points at live Supabase. `--no-reset` keeps the current data.
import { spawn } from "node:child_process";
import { resetTestDb } from "../e2e/db";
import { seed } from "../e2e/seed";
import { DEV_TEST_PORT, DEV_TEST_URL, E2E_AUTH_SECRET, TEST_DATABASE_URL } from "../e2e/env";

async function main() {
  if (!process.argv.includes("--no-reset")) {
    await resetTestDb();
    await seed();
    console.log(`Test database ready: ${TEST_DATABASE_URL}`);
  }

  const server = spawn(
    "pnpm",
    ["exec", "vite", "dev", "--port", String(DEV_TEST_PORT), "--strictPort"],
    {
      stdio: "inherit",
      // Same overrides as the Playwright web server: test DB, test sign-in, no Sheet or Storage writes
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
        E2E_AUTH_SECRET,
        GOOGLE_SHEET_WEBHOOK_URL: "",
        // No live Storage either: receipt uploads would land in the real bucket
        SUPABASE_SERVICE_ROLE_KEY: "",
        TZ: "Asia/Kuala_Lumpur",
      },
    },
  );
  console.log(`Dev server (test DB) starting on ${DEV_TEST_URL}`);
  server.on("exit", (code) => process.exit(code ?? 0));
}

void main();
