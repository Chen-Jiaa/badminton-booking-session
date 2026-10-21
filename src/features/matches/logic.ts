// Pure match rules and leaderboard maths. No server imports: used by both the
// server functions and the UI.

export type MatchFormat = "SINGLES" | "DOUBLES";
export type MatchStatus = "INVITED" | "IN_PLAY" | "AWAITING_CONFIRM" | "CONFIRMED" | "DECLINED";
export type Side = "A" | "B";

/** Badminton tops out at 30 points (29-all, golden point). */
export const MAX_SCORE = 30;
/** How long an invite or an entered result waits for the other side. */
export const RESPONSE_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Matches can be recorded until this long after the session ends. */
export const RECORDING_GRACE_MS = 24 * 60 * 60 * 1000;

/** Malaysia has no DST, so month boundaries are a fixed UTC+8 offset. */
const CLUB_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface MatchPlayerView {
  userId: string;
  name: string;
  image: string | null;
  side: Side;
  /** Set for a guest: their sponsor can answer for them (guests have no login). */
  sponsorId?: string | null;
}

export interface MatchView {
  id: string;
  sessionId: string;
  format: MatchFormat;
  status: MatchStatus;
  scoreA: number | null;
  scoreB: number | null;
  previousScoreA: number | null;
  previousScoreB: number | null;
  createdById: string;
  submittedById: string | null;
  expiresAt: Date;
  createdAt: Date;
  /** Bumped on every change; mutations guard on it so a stale view can't win. */
  updatedAt: Date;
  players: MatchPlayerView[];
}

/** Why a score can't be submitted, or null when it's fine. */
export function scoreProblem(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Enter both scores";
  if (a === b) return "Scores can't be level";
  if (Math.max(a, b) > MAX_SCORE) return `Max is ${MAX_SCORE} points`;
  return null;
}

export function sideOf(m: Pick<MatchView, "players">, userId: string): Side | null {
  // Playing yourself beats acting for a guest of yours
  return (
    (m.players.find((p) => p.userId === userId) ?? m.players.find((p) => p.sponsorId === userId))
      ?.side ?? null
  );
}

export const otherSide = (s: Side): Side => (s === "A" ? "B" : "A");

/** Which side has to respond next, or null when nobody does. */
export function waitingSide(
  m: Pick<MatchView, "status" | "players" | "createdById" | "submittedById">,
): Side | null {
  if (m.status === "INVITED") {
    const creator = sideOf(m, m.createdById);
    return creator ? otherSide(creator) : null;
  }
  if (m.status === "AWAITING_CONFIRM" && m.submittedById) {
    const submitter = sideOf(m, m.submittedById);
    return submitter ? otherSide(submitter) : null;
  }
  return null;
}

/** Pending matches stop being actionable once their window has passed. */
export function isExpired(m: Pick<MatchView, "status" | "expiresAt">, now = new Date()) {
  return (m.status === "INVITED" || m.status === "AWAITING_CONFIRM") && m.expiresAt < now;
}

/** Nobody on the waiting side can answer (singles against your own guest). */
export function isStuck(m: MatchView, now = new Date()) {
  const side = waitingSide(m);
  return !!side && !isExpired(m, now) && !sideHasResponder(m.players, side);
}

/**
 * `canReferee`: the viewer runs this session (its host, or an admin). They step in
 * only when the match is stuck, and never on a match they play in.
 */
export function isWaitingOn(m: MatchView, userId: string, now = new Date(), canReferee = false) {
  const side = waitingSide(m);
  if (!side || isExpired(m, now)) return false;
  // A player answers for themselves only: a member playing against their own guest
  // can't also confirm for that guest
  const self = m.players.find((p) => p.userId === userId);
  if (self) return self.side === side;
  if (m.players.some((p) => p.side === side && p.sponsorId === userId)) return true;
  return canReferee && isStuck(m, now);
}

/**
 * Whether anyone can answer for `side`: a real player, or a guest whose sponsor isn't
 * playing on the other side.
 */
export function sideHasResponder(
  players: Pick<MatchPlayerView, "userId" | "side" | "sponsorId">[],
  side: Side,
) {
  const opposing = new Set(players.filter((p) => p.side !== side).map((p) => p.userId));
  return players.some((p) => p.side === side && (!p.sponsorId || !opposing.has(p.sponsorId)));
}

export function winnerSide(m: Pick<MatchView, "scoreA" | "scoreB">): Side | null {
  if (m.scoreA === null || m.scoreB === null || m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "A" : "B";
}

/* ------------------------------------------------------------------ */
/* Months                                                              */
/* ------------------------------------------------------------------ */

/** "2026-10" for the club-local month containing `date`. */
export function monthKeyOf(date: Date): string {
  const local = new Date(date.getTime() + CLUB_UTC_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/** UTC instants bounding a club-local month: [start, end). */
export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - CLUB_UTC_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - CLUB_UTC_OFFSET_MS),
  };
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days left in the club-local month, counting today. */
export function daysLeftInMonth(key: string, now = new Date()): number {
  const { end } = monthRange(key);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export interface StandingPerson {
  id: string;
  name: string;
  image: string | null;
}

export interface Standing {
  /** One person for a player row, two for a doubles team. */
  people: StandingPerson[];
  wins: number;
  losses: number;
  /** Rally points their side scored, summed over every match, whoever the partner was. */
  points: number;
  /** Results in play order, oldest first, e.g. "WWLWW". */
  form: string;
  /** Play-order index of the match that last raised the ranking number (points or wins). */
  reachedAt: number;
}

export const played = (s: Standing) => s.wins + s.losses;
export const winRate = (s: Standing) => (played(s) ? Math.round((s.wins / played(s)) * 100) : 0);
/** Current run of wins at the end of the form. */
export const streak = (s: Standing) => s.form.length - s.form.replace(/W+$/, "").length;

/** A confirmed match with its players, ordered by when it was played. */
export interface ConfirmedMatch {
  format: MatchFormat;
  scoreA: number;
  scoreB: number;
  players: MatchPlayerView[];
}

/**
 * Players are ranked by points scored across every match (doubles included, any
 * partner). Teams are doubles pairs ranked by wins together. One confirmed match is
 * enough to be ranked. Ties fall to more wins, then the better win rate, then whoever
 * got there first.
 */
export function buildStandings(confirmed: ConfirmedMatch[]) {
  const players = new Map<string, Standing>();
  const teams = new Map<string, Standing>();

  const tally = (
    map: Map<string, Standing>,
    key: string,
    people: StandingPerson[],
    won: boolean,
    points: number,
    rankedByPoints: boolean,
    index: number,
  ) => {
    const s = map.get(key) ?? { people, wins: 0, losses: 0, points: 0, form: "", reachedAt: index };
    if (won) s.wins++;
    else s.losses++;
    s.points += points;
    s.form += won ? "W" : "L";
    if (rankedByPoints ? points > 0 : won) s.reachedAt = index;
    map.set(key, s);
  };

  confirmed.forEach((m, index) => {
    const winner = m.scoreA > m.scoreB ? "A" : "B";
    for (const side of ["A", "B"] as const) {
      const onSide = m.players.filter((p) => p.side === side);
      const won = side === winner;
      const points = side === "A" ? m.scoreA : m.scoreB;
      const people = onSide.map((p) => ({ id: p.userId, name: p.name, image: p.image }));
      for (const person of people) tally(players, person.id, [person], won, points, true, index);
      if (m.format === "DOUBLES" && people.length === 2) {
        const pair = [...people].sort((x, y) => x.id.localeCompare(y.id));
        tally(teams, pair.map((p) => p.id).join(":"), pair, won, points, false, index);
      }
    }
  });

  const rank = (list: Standing[], byPoints: boolean) =>
    list.sort(
      (a, b) =>
        (byPoints ? b.points - a.points : 0) ||
        b.wins - a.wins ||
        winRate(b) - winRate(a) ||
        a.reachedAt - b.reachedAt,
    );

  return {
    players: rank(Array.from(players.values()), true),
    teams: rank(Array.from(teams.values()), false),
  };
}
