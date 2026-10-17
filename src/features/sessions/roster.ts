// Server-only roster moves (deposits, waitlist promotion). Import these only from
// inside server-function handlers so `db` stays out of the browser bundle.
import { db } from "@/db";
import { attendances, ledger, users, type Session, type User } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { waitlistOrder } from "./rules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * What the player is actually holding for this session — the net of their
 * deposit/refund ledger rows, not the current minBalance, so an admin editing
 * minBalance after they joined can't change what's returned.
 */
export async function heldDeposit(tx: Tx, sessionId: string, userId: string): Promise<number> {
  const rows = await tx.query.ledger.findMany({
    where: and(
      eq(ledger.sessionId, sessionId),
      eq(ledger.userId, userId),
      inArray(ledger.type, ["SESSION_DEPOSIT", "SESSION_REFUND"]),
    ),
  });
  return -rows.reduce((total, e) => total + parseFloat(e.amount), 0);
}

/** Returns the player's held deposit to their wallet. Returns the new balance, or null if nothing was held. */
export async function refundDeposit(
  tx: Tx,
  { sessionId, userId, actorId }: { sessionId: string; userId: string; actorId: string },
): Promise<string | null> {
  const held = await heldDeposit(tx, sessionId, userId);
  if (held <= 0) return null;

  const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  const newBalance = (parseFloat(user.balance) + held).toFixed(2);
  await tx
    .update(users)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await tx.insert(ledger).values({
    userId,
    type: "SESSION_REFUND",
    amount: held.toFixed(2),
    balanceAfter: newBalance,
    note: "Deposit refund",
    createdById: actorId,
    sessionId,
  });
  return newBalance;
}

/** Takes the session deposit from the player's wallet. Returns the new balance. */
export async function takeDeposit(
  tx: Tx,
  { session, user, actorId }: { session: Session; user: User; actorId: string },
): Promise<string> {
  const deposit = parseFloat(session.minBalance);
  if (deposit <= 0) return user.balance;

  const newBalance = (parseFloat(user.balance) - deposit).toFixed(2);

  await tx
    .update(users)
    .set({ balance: newBalance, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await tx.insert(ledger).values({
    userId: user.id,
    type: "SESSION_DEPOSIT",
    amount: (-deposit).toFixed(2),
    balanceAfter: newBalance,
    note: "Session deposit",
    createdById: actorId,
    sessionId: session.id,
  });
  return newBalance;
}

/**
 * Moves a waitlisted player into a free spot and takes their deposit. Picks
 * `userId` if given, otherwise the longest-waiting player who can afford the
 * deposit. Returns the promoted user, or null when there's no free spot or no
 * one eligible.
 */
export async function promoteFromWaitlist(
  tx: Tx,
  { session, actorId, userId }: { session: Session; actorId: string; userId?: string },
): Promise<User | null> {
  const rows = await tx.query.attendances.findMany({
    where: eq(attendances.sessionId, session.id),
    with: { user: true },
  });
  const confirmed = rows.filter((a) => a.status === "YES").length;
  if (confirmed >= session.maxPlayers) return null;

  const deposit = parseFloat(session.minBalance);
  const queue = waitlistOrder(rows);
  const next = userId
    ? queue.find((a) => a.userId === userId)
    : queue.find((a) => parseFloat(a.user.balance) >= deposit);
  if (!next || parseFloat(next.user.balance) < deposit) return null;

  await takeDeposit(tx, { session, user: next.user, actorId });
  await tx
    .update(attendances)
    .set({ status: "YES", waitlistedAt: null, updatedAt: new Date() })
    .where(eq(attendances.id, next.id));
  return next.user;
}

/** Push subscriptions of the admins plus the session's host. */
export async function approverTokens(session: Session): Promise<string[]> {
  const approvers = await db.query.users.findMany({
    where: (u, { or, eq: eqOp }) => or(eqOp(u.role, "ADMIN"), eqOp(u.id, session.createdById)),
    columns: { fcmToken: true },
  });
  return approvers.map((a) => a.fcmToken).filter((t): t is string => !!t);
}
