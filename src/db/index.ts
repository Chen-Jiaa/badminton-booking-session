import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { db: Db | undefined };

let cached: Db | undefined;

function getDb(): Db {
  if (cached) return cached;

  // Reused across HMR reloads in dev so we don't leak connection pools.
  if (globalForDb.db) {
    cached = globalForDb.db;
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  cached = drizzle(postgres(connectionString, { prepare: false }), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.db = cached;
  }
  return cached;
}

/**
 * The connection is opened on first use, never at import time.
 *
 * This module can end up in the client module graph — server functions
 * reference their middleware chain outside the stripped handler bodies, which
 * keeps those imports alive. Connecting at module scope would throw
 * "DATABASE_URL is not set" during module evaluation in the browser and kill
 * the client entry before React hydrates, turning the whole app into dead
 * markup. Behind this proxy, importing is free and only an actual query —
 * which client code never performs — can fail.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
