// Server-only wallet primitives. Import only from inside server-function handlers so
// `db` stays out of the browser bundle.
//
// Concurrency rules (e2e/races.spec.ts replays requests in parallel to check them):
// balances change only through `adjustBalance`, never by writing a value computed from
// an earlier read; every transaction that changes a session's roster calls
// `lockSession` first so roster moves on one session run one at a time; and request
// rows are claimed with `UPDATE … WHERE status = 'PENDING' RETURNING`.
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Adds `delta` (negative to take money) to the user's balance in a single UPDATE and
 * returns the new balance. With `floor`, the update only happens if the balance stays
 * at or above it, and null is returned otherwise (e.g. not enough for a deposit).
 */
export async function adjustBalance(
  tx: Tx,
  userId: string,
  delta: number,
  { floor }: { floor?: number } = {},
): Promise<string | null> {
  const amount = delta.toFixed(2);
  const [row] = await tx
    .update(users)
    .set({ balance: sql`${users.balance} + ${amount}::numeric`, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        floor === undefined
          ? undefined
          : sql`${users.balance} + ${amount}::numeric >= ${floor.toFixed(2)}::numeric`,
      ),
    )
    .returning({ balance: users.balance });
  return row?.balance ?? null;
}

/**
 * Locks the session row until the transaction ends and returns it fresh. Concurrent
 * joins, leaves and promotions on the same session wait here, so capacity and deposit
 * checks made after this see the latest roster. Null if the session is gone.
 */
export async function lockSession(tx: Tx, sessionId: string) {
  const [row] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
  return row ?? null;
}
