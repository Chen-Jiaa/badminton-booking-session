// Server-only: bringing friends (guests) to a session. Import only from inside
// server-function handlers so `db` stays out of the browser bundle.
//
// A guest is a `users` row with `isGuest` and a `sponsorId`: no login, no wallet. The
// sponsor's wallet pays every deposit and share (see `payerOf` in roster.ts).
import { attendances, users, type Session, type User } from "@/db/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import { adjustBalance, type Tx } from "@/lib/wallet";
import { GUEST_LIMIT, isLateCancel } from "./rules";
import { type Promoted, promoteFromWaitlist, refundDeposit, takeDeposit } from "./roster";

export interface GuestChanges {
  add: { name: string; guestId?: string }[];
  remove: string[];
}

export interface GuestOutcome {
  added: number;
  waitlisted: number;
  removed: number;
  /** Removals inside 24h that now wait for a host/admin */
  requested: number;
}

/** Thrown to abort the transaction with a message for the UI. */
export class GuestError extends Error {}

/**
 * Applies a sponsor's guest edits to one session. Runs inside the caller's transaction
 * after `lockSession`; throws GuestError (rolling everything back) when any part can't
 * be done, so "Save" is all or nothing.
 */
export async function applyGuestChanges(
  tx: Tx,
  {
    session,
    sponsor,
    changes,
    now,
  }: { session: Session; sponsor: User; changes: GuestChanges; now: Date },
): Promise<{
  outcome: GuestOutcome;
  lateCancelNames: string[];
  promoted: Promoted[];
}> {
  const outcome: GuestOutcome = { added: 0, waitlisted: 0, removed: 0, requested: 0 };
  const lateCancelNames: string[] = [];
  const promoted: Promoted[] = [];

  const myGuests = await tx.query.users.findMany({
    where: and(eq(users.sponsorId, sponsor.id), eq(users.isGuest, true)),
  });
  const guestIds = myGuests.map((g) => g.id);
  const rows = guestIds.length
    ? await tx.query.attendances.findMany({
        where: and(eq(attendances.sessionId, session.id), inArray(attendances.userId, guestIds)),
      })
    : [];
  const attendanceOf = (guestId: string) => rows.find((a) => a.userId === guestId);

  // ── Removals first, so a freed seat can go to the waitlist (or a new guest) ──
  for (const guestId of Array.from(new Set(changes.remove))) {
    const guest = myGuests.find((g) => g.id === guestId);
    const a = attendanceOf(guestId);
    if (!guest || !a || a.status === "NO") continue;

    if (a.status === "WAITLIST") {
      await tx
        .update(attendances)
        .set({ status: "NO", waitlistedAt: null, updatedAt: now })
        .where(eq(attendances.id, a.id));
      a.status = "NO";
      outcome.removed++;
      continue;
    }

    if (isLateCancel(session.startTime, now)) {
      if (a.lateCancelStatus === "PENDING") continue;
      if (a.lateCancelStatus === "REJECTED") {
        throw new GuestError(`${guest.name}'s late cancellation was declined: they're still on`);
      }
      await tx
        .update(attendances)
        .set({
          lateCancelStatus: "PENDING",
          lateCancelRequestedAt: now,
          lateCancelResolvedAt: null,
          lateCancelResolvedById: null,
          updatedAt: now,
        })
        .where(eq(attendances.id, a.id));
      a.lateCancelStatus = "PENDING";
      outcome.requested++;
      lateCancelNames.push(`${guest.name} (guest of ${sponsor.name})`);
      continue;
    }

    await refundDeposit(tx, { sessionId: session.id, userId: guestId, actorId: sponsor.id });
    await tx
      .update(attendances)
      .set({ status: "NO", updatedAt: now })
      .where(eq(attendances.id, a.id));
    a.status = "NO";
    outcome.removed++;
    const next = await promoteFromWaitlist(tx, { session, actorId: sponsor.id });
    if (next) promoted.push(next);
  }

  // ── Additions ──
  if (changes.add.length === 0) return { outcome, lateCancelNames, promoted };

  // Once the game is on, friends who turn up late can still take a free seat (no deadline,
  // no waitlist) until it ends.
  const started = now >= session.startTime;
  if (now >= session.endTime) {
    throw new GuestError("RSVPs are closed: the session has ended");
  }
  if (!started && session.rsvpDeadline && now >= session.rsvpDeadline) {
    throw new GuestError("RSVP deadline has passed");
  }

  const active = () => rows.filter((a) => a.status === "YES" || a.status === "WAITLIST").length;
  const deposit = parseFloat(session.minBalance);

  for (const wanted of changes.add) {
    let guest =
      (wanted.guestId ? myGuests.find((g) => g.id === wanted.guestId) : undefined) ??
      myGuests.find((g) => g.name.toLowerCase() === wanted.name.toLowerCase());
    if (wanted.guestId && !guest) throw new GuestError("That friend isn't on your list");
    // Typing a deleted friend's name again brings them back
    if (guest?.archivedAt) {
      await tx.update(users).set({ archivedAt: null }).where(eq(users.id, guest.id));
      guest.archivedAt = null;
    }

    const existing = guest ? attendanceOf(guest.id) : undefined;
    if (existing && (existing.status === "YES" || existing.status === "WAITLIST")) continue;

    if (active() >= GUEST_LIMIT) {
      throw new GuestError(`You can bring up to ${GUEST_LIMIT} friends to one game`);
    }

    if (!guest) {
      [guest] = await tx
        .insert(users)
        .values({ name: wanted.name, isGuest: true, sponsorId: sponsor.id })
        .returning();
      myGuests.push(guest);
    }

    const [{ n: confirmed }] = await tx
      .select({ n: count() })
      .from(attendances)
      .where(and(eq(attendances.sessionId, session.id), eq(attendances.status, "YES")));
    const isFull = confirmed >= session.maxPlayers;
    if (isFull && started) {
      throw new GuestError("The game has started and there are no free spots");
    }

    // Waitlisted guests pay when promoted, but the deposit must be on hand now
    const balance = await adjustBalance(tx, sponsor.id, 0);
    if (balance === null || parseFloat(balance) < deposit) {
      throw new GuestError("INSUFFICIENT_BALANCE");
    }
    if (!isFull) {
      const taken = await takeDeposit(tx, { session, userId: guest.id, actorId: sponsor.id });
      if (taken === null) throw new GuestError("INSUFFICIENT_BALANCE");
    }

    const fresh = {
      status: isFull ? ("WAITLIST" as const) : ("YES" as const),
      waitlistedAt: isFull ? now : null,
      lateCancelStatus: null,
      lateCancelRequestedAt: null,
      lateCancelResolvedAt: null,
      lateCancelResolvedById: null,
      // A friend brought back after leaving joins afresh (join time, Early Bird badge)
      createdAt: now,
      updatedAt: now,
    };
    if (existing) {
      await tx.update(attendances).set(fresh).where(eq(attendances.id, existing.id));
      Object.assign(existing, fresh);
    } else {
      const [row] = await tx
        .insert(attendances)
        .values({ sessionId: session.id, userId: guest.id, ...fresh })
        .returning();
      rows.push(row);
    }
    if (isFull) outcome.waitlisted++;
    else outcome.added++;
  }

  return { outcome, lateCancelNames, promoted };
}
