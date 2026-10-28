// Attendance leaderboard maths. Pure and client-safe.

export interface AttendanceRow {
  id: string;
  name: string;
  image: string | null;
  /** Finalized sessions this month they were on the roster for */
  attended: number;
  /** Average time from "session posted" to "they joined", in ms */
  avgJoinMs: number;
  fastestJoinMs: number;
}

export interface AttendanceBoard {
  month: string;
  /** Finalized sessions in the month, for the "x of y" attendance rate */
  totalSessions: number;
  players: AttendanceRow[];
}

export type AttendanceSort = "attended" | "speed";

/** Most sessions first (ties: quicker joiner). Or quickest joiner first (ties: more sessions). */
export function sortAttendance(rows: AttendanceRow[], by: AttendanceSort): AttendanceRow[] {
  return [...rows].sort((a, b) =>
    by === "attended"
      ? b.attended - a.attended || a.avgJoinMs - b.avgJoinMs
      : a.avgJoinMs - b.avgJoinMs || b.attended - a.attended,
  );
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "5m", "3h 20m", "2d 4h": two units at most, so it fits a narrow column. */
export function formatJoinTime(ms: number): string {
  if (ms < MIN) return "<1m";
  if (ms < HOUR) return `${Math.round(ms / MIN)}m`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.round((ms % HOUR) / MIN);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(ms / DAY);
  const h = Math.round((ms % DAY) / HOUR);
  return h ? `${d}d ${h}h` : `${d}d`;
}
