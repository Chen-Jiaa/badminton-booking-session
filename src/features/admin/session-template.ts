// Plain helpers, safe for the client bundle: no db access here.

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A session's settings carried over to prefill the create form. Times are Malaysia wall-clock. */
export interface SessionTemplate {
  sourceDate: string; // YYYY-MM-DD of the session it was copied from
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  rsvpDeadline: { date: string; time: string } | null;
  courts: number;
  costPerCourt: number;
  location: string | null;
  locationMapUrl: string | null;
  courtNumbers: string | null;
  maxPlayers: number;
  minBalance: number;
  note: string | null;
}

interface SourceSession {
  startTime: Date;
  endTime: Date;
  rsvpDeadline: Date | null;
  courts: number;
  costPerCourt: string;
  location: string | null;
  locationMapUrl: string | null;
  courtNumbers: string | null;
  maxPlayers: number;
  minBalance: string;
  note: string | null;
}

function wallClock(ms: number) {
  const d = new Date(ms + MYT_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/**
 * Same slot, the next week it hasn't happened yet: a Thursday 8pm session becomes the
 * coming Thursday 8pm. Whole weeks keep the wall-clock time (Malaysia has no DST).
 * The RSVP deadline keeps its distance from the start.
 */
export function templateFromSession(session: SourceSession, now = new Date()): SessionTemplate {
  const start = session.startTime.getTime();
  const weeks = Math.max(1, Math.floor((now.getTime() - start) / WEEK_MS) + 1);
  const shift = weeks * WEEK_MS;
  const nextStart = wallClock(start + shift);

  return {
    sourceDate: wallClock(start).date,
    date: nextStart.date,
    startTime: nextStart.time,
    endTime: wallClock(session.endTime.getTime() + shift).time,
    rsvpDeadline: session.rsvpDeadline ? wallClock(session.rsvpDeadline.getTime() + shift) : null,
    courts: session.courts,
    costPerCourt: parseFloat(session.costPerCourt),
    location: session.location,
    locationMapUrl: session.locationMapUrl,
    courtNumbers: session.courtNumbers,
    maxPlayers: session.maxPlayers,
    minBalance: parseFloat(session.minBalance),
    note: session.note,
  };
}

/** "2026-10-23" + "20:00" as a local Date, the way the form holds dates. */
export function localDate(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}
