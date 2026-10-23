// `pnpm dev:local`: a dev server for clicking around by hand, on its own local database
// (`badminton_dev`, never live Supabase). Sign in at /api/dev-login. Unlike `dev:test`
// it keeps your data between runs: the DB is built and seeded only when it doesn't exist
// yet, or with `--reset`. `--host` also serves it on your Wi-Fi, to open on a phone. Starts at port 3201 and moves up if that's taken (Vite's default).
// `DEV_DATABASE_URL` overrides the database, e.g. postgres://localhost:5432/badminton_dev_x.
import { spawn } from "node:child_process";
import postgres from "postgres";

const DEV_DATABASE_URL = process.env.DEV_DATABASE_URL ?? "postgres://localhost:5432/badminton_dev";
const DEV_LOCAL_PORT = 3201;

async function dbExists(url: URL) {
  const admin = postgres({
    host: url.hostname,
    port: Number(url.port || 5432),
    username: url.username || undefined,
    password: url.password || undefined,
    database: "postgres",
    onnotice: () => {},
  });
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${url.pathname.slice(1)}`;
    return rows.length > 0;
  } finally {
    await admin.end();
  }
}

async function main() {
  // The e2e helpers read this at import time, so set it before importing them
  process.env.TEST_DATABASE_URL = DEV_DATABASE_URL;
  const { resetTestDb } = await import("../e2e/db");
  const { seed } = await import("../e2e/seed");
  const { E2E_AUTH_SECRET } = await import("../e2e/env");

  const url = new URL(DEV_DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`Refusing to use non-local database: ${url.hostname}`);
  }

  if (process.argv.includes("--reset") || !(await dbExists(url))) {
    await resetTestDb();
    await seed();
    console.log(`Dev database built and seeded: ${DEV_DATABASE_URL}`);
  } else {
    console.log(`Using existing dev database: ${DEV_DATABASE_URL} (--reset for a fresh seed)`);
  }

  const server = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "dev",
      "--port",
      String(DEV_LOCAL_PORT),
      ...(process.argv.includes("--host") ? ["--host"] : []),
    ],
    {
      stdio: "inherit",
      // Same overrides as dev:test: local DB, test sign-in, no Sheet or Storage writes
      env: {
        ...process.env,
        DATABASE_URL: DEV_DATABASE_URL,
        E2E_AUTH_SECRET,
        GOOGLE_SHEET_WEBHOOK_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        TZ: "Asia/Kuala_Lumpur",
      },
    },
  );
  console.log("Sign in at <the URL below>/api/dev-login");
  server.on("exit", (code) => process.exit(code ?? 0));
}

void main();
