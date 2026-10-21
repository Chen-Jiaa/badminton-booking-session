// Server-only roster moves (deposits, waitlist promotion). Import these only from
// inside server-function handlers so `db` stays out of the browser bundle.
import { db } from "@/db";
import { attendances, ledger, users, type Session, type User } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { adjustBalance, lockSession, type Tx } from "@/lib/wallet";
import { waitlistOrder } from "./rules";

/**
 * Whose wallet pays for an attendee: their own, or their sponsor's when they're a
 * guest. Every deposit/refund/share for a guest lands on the sponsor's wallet, tagged
 * with `guestId` so the guest's money can be told apart from the sponsor's own.
 */
export async function payerOf(
  tx: Tx,
  userId: string,
): Promise<{ payerId: string; guestId: string | null; guestName: string | null }> {
  const u = await tx.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, isGuest: true, sponsorId: true },
  });
  if (u?.isGuest && u.sponsorId) return { payerId: u.sponsorId, guestId: u.id, guestName: u.name };
  return { payerId: userId, guestId: null, guestName: null };
}

/**
 * What the player is actually holding for this session — the net of their
 * deposit/refund ledger rows, not the current minBalance, so an admin editing
 * minBalance after they joined can't change what's returned.
 */
export async function heldDeposit(tx: Tx, sessionId: string, userId: string): Promise<number> {
  const { payerId, guestId } = await payerOf(tx, userId);
  const rows = await tx.query.ledger.findMany({
    where: and(
      eq(ledger.sessionId, sessionId),
      eq(ledger.userId, payerId),
      guestId ? eq(ledger.guestId, guestId) : isNull(ledger.guestId),
      inArray(ledger.type, ["SESSION_DEPOSIT", "SESSION_REFUND"]),
    ),
  });
  return -rows.reduce((total, e) => total + parseFloat(e.amount), 0);
}

/**
 * Returns the player's held deposit to their wallet. Returns the new balance, or null
 * if nothing was held. Locks the session first, so two refunds racing each other run
 * one after the other and the second finds nothing left to return.
 */
export async function refundDeposit(
  tx: Tx,
  { sessionId, userId, actorId }: { sessionId: string; userId: string; actorId: string },
): Promise<string | null> {
  await lockSession(tx, sessionId);
  const held = await heldDeposit(tx, sessionId, userId);
  if (held <= 0) return null;

  const { payerId, guestId, guestName } = await payerOf(tx, userId);
  const newBalance = await adjustBalance(tx, payerId, held);
  if (newBalance === null) return null;
  await tx.insert(ledger).values({
    userId: payerId,
    guestId,
    type: "SESSION_REFUND",
    amount: held.toFixed(2),
    balanceAfter: newBalance,
    note: guestName ? `Deposit refund (guest ${guestName})` : "Deposit refund",
    createdById: actorId,
    sessionId,
  });
  return newBalance;
}

/**
 * Takes the session deposit from the player's wallet (their sponsor's, for a guest). Returns the new balance, or
 * null (and changes nothing) when they can't cover it.
 */
export async function takeDeposit(
  tx: Tx,
  { session, userId, actorId }: { session: Session; userId: string; actorId: string },
): Promise<string | null> {
  const deposit = parseFloat(session.minBalance);
  const { payerId, guestId, guestName } = await payerOf(tx, userId);
  if (deposit <= 0) {
    // Nothing to take; still report the current balance
    return adjustBalance(tx, payerId, 0);
  }

  const newBalance = await adjustBalance(tx, payerId, -deposit, { floor: 0 });
  if (newBalance === null) return null;
  await tx.insert(ledger).values({
    userId: payerId,
    guestId,
    type: "SESSION_DEPOSIT",
    amount: (-deposit).toFixed(2),
    balanceAfter: newBalance,
    note: guestName ? `Session deposit (guest ${guestName})` : "Session deposit",
    createdById: actorId,
    sessionId: session.id,
  });
  return newBalance;
}

/** Who to notify after a waitlist promotion; `guestName` is set when a guest got the spot. */
export type Promoted = User & { guestName?: string };

/**
 * Moves a waitlisted player into a free spot and takes their deposit. Picks
 * `userId` if given, otherwise the longest-waiting player who can afford the
 * deposit. Returns the promoted user (the sponsor, for a guest), or null when
 * there's no free spot or no one eligible.
 */
export async function promoteFromWaitlist(
  tx: Tx,
  { session: stale, actorId, userId }: { session: Session; actorId: string; userId?: string },
): Promise<Promoted | null> {
  const session = await lockSession(tx, stale.id);
  if (!session || session.status !== "OPEN") return null;

  const rows = await tx.query.attendances.findMany({
    where: eq(attendances.sessionId, session.id),
    with: { user: true },
  });
  const confirmed = rows.filter((a) => a.status === "YES").length;
  if (confirmed >= session.maxPlayers) return null;

  const queue = waitlistOrder(rows);
  const candidates = userId ? queue.filter((a) => a.userId === userId) : queue;
  for (const next of candidates) {
    // Guarded on the live balance, so someone who spent it meanwhile is skipped
    const newBalance = await takeDeposit(tx, { session, userId: next.userId, actorId });
    if (newBalance === null) continue;
    await tx
      .update(attendances)
      .set({ status: "YES", waitlistedAt: null, updatedAt: new Date() })
      .where(eq(attendances.id, next.id));
    // A guest has no phone to buzz: tell (and report the balance of) whoever pays
    if (next.user.isGuest && next.user.sponsorId) {
      const sponsor = await tx.query.users.findFirst({ where: eq(users.id, next.user.sponsorId) });
      if (sponsor) return { ...sponsor, balance: newBalance, guestName: next.user.name };
    }
    return { ...next.user, balance: newBalance };
  }
  return null;
}

/** Push subscriptions of the admins plus the session's host. */
export async function approverTokens(session: Session): Promise<string[]> {
  const approvers = await db.query.users.findMany({
    where: (u, { or, eq: eqOp }) => or(eqOp(u.role, "ADMIN"), eqOp(u.id, session.createdById)),
    columns: { fcmToken: true },
  });
  return approvers.map((a) => a.fcmToken).filter((t): t is string => !!t);
}
