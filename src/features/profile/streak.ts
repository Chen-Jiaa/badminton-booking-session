// Pure streak maths. No server imports: used by the server function and the UI.
// A "day" is a club-local (Malaysia, UTC+8) date key like "2026-10-23". A streak counts
// consecutive Monday–Sunday weeks in which the player attended at least one session.

const CLUB_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-23" for the club-local day containing `date`. */
export function dayKeyOf(date: Date): string {
  return new Date(date.getTime() + CLUB_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Index of the Monday-based week a day falls in (epoch day 0 was a Thursday). */
function weekNumber(key: string): number {
  return Math.floor((dayNumber(key) + 3) / 7);
}

export interface StreakSummary {
  /** Consecutive weeks with at least one attended session. */
  weeks: number;
  /** Attended session days inside those weeks. */
  activities: number;
  /** Whether the current week already has one, so the flame is "lit". */
  doneThisWeek: boolean;
}

/**
 * The current week doesn't break the streak until it ends: if nobody has played yet
 * this week, the count carries on from last week.
 */
export function computeStreak(playedDays: string[], todayKey: string): StreakSummary {
  const days = new Set(playedDays);
  const perWeek = new Map<number, number>();
  for (const day of Array.from(days)) {
    const w = weekNumber(day);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }

  const thisWeek = weekNumber(todayKey);
  const doneThisWeek = perWeek.has(thisWeek);
  let w = doneThisWeek ? thisWeek : thisWeek - 1;
  let weeks = 0;
  let activities = 0;
  while (perWeek.has(w)) {
    weeks += 1;
    activities += perWeek.get(w)!;
    w -= 1;
  }
  return { weeks, activities, doneThisWeek };
}

export interface CalendarCell {
  key: string;
  day: number;
  inMonth: boolean;
}

export interface CalendarWeek {
  /** Week number, comparable with `weekOfDay`. */
  week: number;
  cells: CalendarCell[];
}

export function weekOfDay(key: string): number {
  return weekNumber(key);
}

/** Monday-first rows covering the club-local month "YYYY-MM", padded with neighbouring days. */
export function monthCalendar(monthKey: string): CalendarWeek[] {
  const [y, m] = monthKey.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1) / DAY_MS;
  const last = Date.UTC(y, m, 0) / DAY_MS;
  const start = first - ((first + 3) % 7);
  const weeks: CalendarWeek[] = [];
  for (let d = start; d <= last; d += 7) {
    const cells: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date((d + i) * DAY_MS);
      cells.push({
        key: date.toISOString().slice(0, 10),
        day: date.getUTCDate(),
        inMonth: d + i >= first && d + i <= last,
      });
    }
    weeks.push({ week: weekNumber(cells[0].key), cells });
  }
  return weeks;
}
