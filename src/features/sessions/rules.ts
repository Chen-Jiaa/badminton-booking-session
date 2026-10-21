// Attendance rules shared by the server and the UI. No server imports here.

/** Leaving inside this window before the start needs a host/admin to approve. */
export const LATE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isLateCancel(startTime: Date, now = new Date()): boolean {
  return now.getTime() >= startTime.getTime() - LATE_CANCEL_WINDOW_MS;
}

type Queued = { status: string; waitlistedAt: Date | null; createdAt: Date };

/** Waitlisted attendances in the order they'll be offered a spot (oldest first). */
export function waitlistOrder<T extends Queued>(attendances: T[]): T[] {
  return attendances
    .filter((a) => a.status === "WAITLIST")
    .sort(
      (a, b) =>
        (a.waitlistedAt ?? a.createdAt).getTime() - (b.waitlistedAt ?? b.createdAt).getTime(),
    );
}

/** Admins manage every session; hosts manage the ones they created. */
export function canManageSession(
  user: { id: string; role: string } | null | undefined,
  session: { createdById: string },
): boolean {
  return user?.role === "ADMIN" || (user?.role === "HOST" && session.createdById === user.id);
}

/** Friends one member can have on a single session. */
export const GUEST_LIMIT = 5;
