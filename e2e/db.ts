import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { TEST_DATABASE_URL } from "./env";

/** Throws unless the URL points at this machine, so a reset can never touch live Supabase. */
function assertLocal(url: string) {
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error(`Refusing to use non-local test database: ${hostname}`);
  }
}

/**
 * Drops and recreates the test database, then builds it from `src/db/schema.ts`
 * with `drizzle-kit push`. Not from `drizzle/*.sql`: those files lag behind the
 * schema (the withdrawal payout columns were never generated as a migration).
 */
export async function resetTestDb() {
  assertLocal(TEST_DATABASE_URL);
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const admin = postgres({ ...parts(url), database: "postgres", onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execFileSync("pnpm", ["exec", "drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}

function parts(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: url.username || undefined,
    password: url.password || undefined,
  };
}

/**
 * Empties every table, keeping the schema. Much faster than `resetTestDb()`, so
 * it runs before each test to give it a fresh copy of the seed.
 */
export async function truncateTestDb() {
  assertLocal(TEST_DATABASE_URL);
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const tables = await client<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    if (tables.length === 0) return;
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await client.unsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

/** Opens a Drizzle client on the test database. Call `close()` when done. */
export function testDb() {
  assertLocal(TEST_DATABASE_URL);
  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
