// Pure badge maths. No server imports: the server function feeds it rows and the tests
// can too. Everything is counted from data the app already stores; nothing is saved.
//
// Counted for members only (guests never earn badges). "Finalized" sessions are
// LOCKED ones. Month-based badges only count months that have ended, so a number never
// goes down after it was shown.
import {
  buildStandings,
  monthKeyOf,
  type ConfirmedMatch,
  type Side,
} from "@/features/matches/logic";
import { dayKeyOf, longestStreak } from "@/features/profile/streak";
import { BADGES, FOUNDING_CUTOFF, type BadgeId } from "./catalog";

const HOUR_MS = 60 * 60 * 1000;
/** RSVPing within this long of a session being posted counts as an "early bird". */
export const EARLY_BIRD_MS = HOUR_MS;

export interface BadgeUser {
  id: string;
  name: string;
  image: string | null;
  createdAt: Date;
  isGuest: boolean;
}

export interface BadgeAttendance {
  userId: string;
  /** Set for a guest: the member who brought them */
  sponsorId: string | null;
  sessionId: string;
  status: "YES" | "NO" | "WAITLIST";
  lateCancelStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** When the RSVP row was created */
  joinedAt: Date;
  sessionStart: Date;
  sessionPosted: Date;
  sessionFinalized: boolean;
}

/** A confirmed match, in the order it was played. */
export interface BadgeMatch extends ConfirmedMatch {
  /** Start time of the session it belongs to: decides which month it counts for */
  sessionStart: Date;
}

export interface BadgeInput {
  users: BadgeUser[];
  attendances: BadgeAttendance[];
  /** Finalized sessions only */
  sessions: { id: string; startTime: Date }[];
  matches: BadgeMatch[];
  now: Date;
}

export type BadgeNumbers = Record<BadgeId, number>;

const empty = (): BadgeNumbers => ({
  regular: 0,
  "never-missed": 0,
  streak: 0,
  "early-bird": 0,
  friend: 0,
  reliable: 0,
  founder: 0,
  champion: 0,
  podium: 0,
  "hot-hand": 0,
  duo: 0,
  rally: 0,
});

const sideWon = (m: ConfirmedMatch, side: Side) => (m.scoreA > m.scoreB ? "A" : "B") === side;

/** Every member's number for every badge (locked ones are 0). */
export function computeBadgeNumbers(input: BadgeInput): Map<string, BadgeNumbers> {
  const { users, attendances, sessions, matches, now } = input;
  const members = users.filter((u) => !u.isGuest);
  const memberIds = new Set(members.map((u) => u.id));
  const out = new Map<string, BadgeNumbers>(members.map((u) => [u.id, empty()]));
  const thisMonth = monthKeyOf(now);
  const ended = (month: string) => month < thisMonth;

  /* ---- Showing up ---- */
  const played = attendances.filter((a) => a.sessionFinalized && a.status === "YES");
  const playedDays = new Map<string, string[]>();
  const sessionsByUserMonth = new Map<string, Map<string, Set<string>>>();

  for (const a of played) {
    // A guest's visit counts for the member who brought them
    if (a.sponsorId && memberIds.has(a.sponsorId)) out.get(a.sponsorId)!.friend++;
    const n = out.get(a.userId);
    if (!n) continue;
    n.regular++;
    if (a.joinedAt.getTime() - a.sessionPosted.getTime() <= EARLY_BIRD_MS) n["early-bird"]++;
    const month = monthKeyOf(a.sessionStart);
    const days = playedDays.get(a.userId) ?? [];
    days.push(dayKeyOf(a.sessionStart));
    playedDays.set(a.userId, days);
    const months = sessionsByUserMonth.get(a.userId) ?? new Map<string, Set<string>>();
    months.set(month, (months.get(month) ?? new Set()).add(a.sessionId));
    sessionsByUserMonth.set(a.userId, months);
  }
  for (const [id, days] of playedDays) out.get(id)!.streak = longestStreak(days);

  // Perfect months: you played every finalized session that month
  const sessionsInMonth = new Map<string, number>();
  for (const s of sessions) {
    const month = monthKeyOf(s.startTime);
    sessionsInMonth.set(month, (sessionsInMonth.get(month) ?? 0) + 1);
  }
  // Clean months: you played, and no late cancellation of yours was approved (or is waiting)
  const lateMonths = new Map<string, Set<string>>();
  for (const a of attendances) {
    if (a.lateCancelStatus !== "APPROVED" && a.lateCancelStatus !== "PENDING") continue;
    const set = lateMonths.get(a.userId) ?? new Set<string>();
    set.add(monthKeyOf(a.sessionStart));
    lateMonths.set(a.userId, set);
  }
  for (const [id, months] of sessionsByUserMonth) {
    const n = out.get(id)!;
    for (const [month, attended] of months) {
      if (!ended(month)) continue;
      if (attended.size === sessionsInMonth.get(month)) n["never-missed"]++;
      if (!lateMonths.get(id)?.has(month)) n.reliable++;
    }
  }

  // Founding members joined within a month of launch
  for (const u of members) if (u.createdAt < FOUNDING_CUTOFF) out.get(u.id)!.founder = 1;

  /* ---- Winning ---- */
  const byMonth = new Map<string, BadgeMatch[]>();
  const run = new Map<string, number>();
  const duoWins = new Map<string, Map<string, number>>();
  for (const m of matches) {
    const month = monthKeyOf(m.sessionStart);
    byMonth.set(month, [...(byMonth.get(month) ?? []), m]);

    for (const p of m.players) {
      const n = out.get(p.userId);
      if (!n) continue;
      const won = sideWon(m, p.side);
      n.rally += p.side === "A" ? m.scoreA : m.scoreB;
      const current = won ? (run.get(p.userId) ?? 0) + 1 : 0;
      run.set(p.userId, current);
      n["hot-hand"] = Math.max(n["hot-hand"], current);
      if (won && m.format === "DOUBLES") {
        const partner = m.players.find((q) => q.side === p.side && q.userId !== p.userId);
        if (partner) {
          const wins = duoWins.get(p.userId) ?? new Map<string, number>();
          wins.set(partner.userId, (wins.get(partner.userId) ?? 0) + 1);
          duoWins.set(p.userId, wins);
          n.duo = Math.max(n.duo, wins.get(partner.userId)!);
        }
      }
    }
  }
  for (const [month, list] of byMonth) {
    if (!ended(month)) continue;
    buildStandings(list)
      .players.slice(0, 3)
      .forEach((s, i) => {
        const n = out.get(s.people[0].id);
        if (!n) return;
        n.podium++;
        if (i === 0) n.champion++;
      });
  }

  // Below its minimum a badge is still locked
  for (const n of out.values()) {
    for (const b of BADGES) if (n[b.id] < b.min) n[b.id] = 0;
  }
  return out;
}

/** How many members hold each badge, as a whole percent of all members. */
export function earnedByPercent(numbers: Map<string, BadgeNumbers>): Record<BadgeId, number> {
  const result = empty();
  for (const b of BADGES) {
    let holders = 0;
    for (const n of numbers.values()) if (n[b.id] > 0) holders++;
    result[b.id] = numbers.size ? Math.round((holders / numbers.size) * 100) : 0;
  }
  return result;
}
