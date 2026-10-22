import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { monthKeyOf, monthLabel, shiftMonth } from "@/features/matches/logic";
import { cn } from "@/lib/utils";
import { playedDaysQueryOptions } from "./server";
import { Shuttlecock } from "./shuttlecock";
import {
  computeStreak,
  dayKeyOf,
  monthCalendar,
  weekOfDay,
  type CalendarCell,
  type StreakSummary,
} from "./streak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const VARIANTS = [
  { id: "a", label: "A · Calendar" },
  { id: "b", label: "B · This week" },
  { id: "c", label: "C · Pink band" },
] as const;
type Variant = (typeof VARIANTS)[number]["id"];

/** PROTOTYPE: three takes on the weekly streak card. `?streak=a|b|c` picks one. */
export function StreakCard() {
  const { data: playedDays } = useQuery(playedDaysQueryOptions());
  const [variant, setVariant] = useState<Variant>("a");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("streak");
    if (v === "a" || v === "b" || v === "c") setVariant(v);
  }, []);

  if (!playedDays) return null;
  const now = new Date();
  const ctx = {
    played: new Set(playedDays),
    todayKey: dayKeyOf(now),
    thisMonth: monthKeyOf(now),
    streak: computeStreak(playedDays, dayKeyOf(now)),
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-medium">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVariant(v.id)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 transition-colors",
              variant === v.id ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {variant === "a" && <CalendarVariant {...ctx} />}
      {variant === "b" && <ThisWeekVariant {...ctx} />}
      {variant === "c" && <BandVariant {...ctx} />}
    </div>
  );
}

interface Ctx {
  played: Set<string>;
  todayKey: string;
  thisMonth: string;
  streak: StreakSummary;
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ShuttleBadge({ streak, size = "md" }: { streak: StreakSummary; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        big ? "h-20 w-[4.5rem]" : "h-14 w-12",
        streak.doneThisWeek ? "text-brand-foreground" : "text-muted-foreground/50",
      )}
    >
      <Shuttlecock className="h-full w-full" />
      <span
        className={cn(
          "absolute inset-0 flex items-end justify-center font-bold text-white",
          big ? "pb-[1.6rem] text-2xl" : "pb-[1.1rem] text-lg",
        )}
      >
        {streak.weeks}
      </span>
    </div>
  );
}

function streakHint(streak: StreakSummary) {
  if (streak.doneThisWeek) return "This week's done";
  return streak.weeks > 0 ? "Play this week to keep it going" : "Play a session to start one";
}

function MonthNav({
  month,
  thisMonth,
  onChange,
}: {
  month: string;
  thisMonth: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted [@media(hover:hover)]:hover:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="font-medium">{monthLabel(month)}</p>
      <button
        type="button"
        aria-label="Next month"
        disabled={month >= thisMonth}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted disabled:opacity-30 [@media(hover:hover)]:hover:bg-muted"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function WeekdayHeader({ spacer }: { spacer?: boolean }) {
  return (
    <>
      {WEEKDAYS.map((d, i) => (
        <span key={i} className="text-xs text-muted-foreground">
          {d}
        </span>
      ))}
      {spacer && <span />}
    </>
  );
}

function DayDot({
  cell,
  played,
  todayKey,
  playedClass,
}: {
  cell: CalendarCell;
  played: boolean;
  todayKey: string;
  playedClass: string;
}) {
  return (
    <span
      aria-label={played ? `Played on ${cell.key}` : undefined}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-sm",
        played ? playedClass : cell.inMonth ? "bg-muted" : "text-muted-foreground/40",
        cell.key === todayKey && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      {played ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : cell.day}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* A · Calendar with a week-tick column (Strava style)                 */
/* ------------------------------------------------------------------ */

function CalendarVariant({ played, todayKey, thisMonth, streak }: Ctx) {
  const [month, setMonth] = useState(thisMonth);
  const weeks = monthCalendar(month);
  const currentWeek = weekOfDay(todayKey);
  const playedWeeks = new Set(Array.from(played).map(weekOfDay));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShuttleBadge streak={streak} />
            <div>
              <p className="text-sm text-muted-foreground">Your streak</p>
              <p className="text-xl font-semibold">
                {streak.weeks} {streak.weeks === 1 ? "week" : "weeks"}
              </p>
              <p className="text-xs text-muted-foreground">{streakHint(streak)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Sessions</p>
            <p className="text-xl font-semibold">{streak.activities}</p>
          </div>
        </div>
        <MonthNav month={month} thisMonth={thisMonth} onChange={setMonth} />
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_2rem] items-center gap-y-2 text-center">
          <WeekdayHeader spacer />
          {weeks.map((week) => (
            <WeekRowA
              key={week.week}
              cells={week.cells}
              played={played}
              todayKey={todayKey}
              weekDone={playedWeeks.has(week.week)}
              isCurrent={week.week === currentWeek}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekRowA({
  cells,
  played,
  todayKey,
  weekDone,
  isCurrent,
}: {
  cells: CalendarCell[];
  played: Set<string>;
  todayKey: string;
  weekDone: boolean;
  isCurrent: boolean;
}) {
  return (
    <>
      {cells.map((c) => (
        <div key={c.key} className="flex justify-center">
          <DayDot
            cell={c}
            played={played.has(c.key)}
            todayKey={todayKey}
            playedClass="bg-brand-foreground text-white"
          />
        </div>
      ))}
      <div className="flex justify-center">
        {weekDone ? (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-foreground text-white"
            aria-label="Week completed"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <span
            className={cn(
              "h-6 w-6 rounded-full border-2",
              isCurrent ? "border-foreground/60" : "border-muted",
            )}
            aria-hidden
          />
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* B · This week up front, 12-week history below (compact, no month)   */
/* ------------------------------------------------------------------ */

function ThisWeekVariant({ played, todayKey, thisMonth, streak }: Ctx) {
  const currentWeek = weekOfDay(todayKey);
  const thisWeekCells = monthCalendar(thisMonth).find((w) => w.week === currentWeek)?.cells ?? [];
  const playedWeeks = new Set(Array.from(played).map(weekOfDay));
  const history = Array.from({ length: 12 }, (_, i) => currentWeek - 11 + i);

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-center gap-4">
          <ShuttleBadge streak={streak} size="lg" />
          <div>
            <p className="text-3xl font-bold leading-none">{streak.weeks}</p>
            <p className="text-sm font-medium">{streak.weeks === 1 ? "week" : "weeks"} in a row</p>
            <p className="mt-1 text-xs text-muted-foreground">{streakHint(streak)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <div className="grid grid-cols-7 gap-1 text-center">
            <WeekdayHeader />
            {thisWeekCells.map((c) => (
              <div key={c.key} className="flex justify-center">
                <DayDot
                  cell={{ ...c, inMonth: true }}
                  played={played.has(c.key)}
                  todayKey={todayKey}
                  playedClass="bg-brand-foreground text-white"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last 12 weeks
          </p>
          <div className="grid grid-cols-12 gap-1">
            {history.map((w) => (
              <span
                key={w}
                aria-label={playedWeeks.has(w) ? "Played" : "No session"}
                className={cn(
                  "h-7 rounded-md",
                  playedWeeks.has(w) ? "bg-brand-foreground" : "bg-muted",
                  w === currentWeek && !playedWeeks.has(w) && "ring-2 ring-foreground/60",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {streak.activities} {streak.activities === 1 ? "session" : "sessions"} in this streak
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* C · Brand-pink band behind each streak week, shuttlecock in the header       */
/* ------------------------------------------------------------------ */

function BandVariant({ played, todayKey, thisMonth, streak }: Ctx) {
  const [month, setMonth] = useState(thisMonth);
  const weeks = monthCalendar(month);
  const inStreak = new Set(streak.streakWeeks);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Weekly streak</p>
            <p className="text-3xl font-bold text-brand-foreground">
              {streak.weeks} {streak.weeks === 1 ? "week" : "weeks"}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak.activities} {streak.activities === 1 ? "session" : "sessions"} ·{" "}
              {streakHint(streak)}
            </p>
          </div>
          <ShuttleBadge streak={streak} size="lg" />
        </div>
        <MonthNav month={month} thisMonth={thisMonth} onChange={setMonth} />
        <div className="grid grid-cols-7 gap-y-2 text-center">
          <WeekdayHeader />
          {weeks.map((week, idx) => {
            const banded = inStreak.has(week.week);
            const prev = inStreak.has(weeks[idx - 1]?.week ?? NaN);
            const next = inStreak.has(weeks[idx + 1]?.week ?? NaN);
            return (
              <div
                key={week.week}
                className={cn(
                  "relative col-span-7 grid grid-cols-7 items-center py-1",
                  banded && "bg-brand",
                  banded && !prev && "rounded-t-full pt-2",
                  banded && !next && "rounded-b-full pb-2",
                )}
              >
                {week.cells.map((c) => (
                  <div key={c.key} className="flex justify-center">
                    <DayDot
                      cell={c}
                      played={played.has(c.key)}
                      todayKey={todayKey}
                      playedClass="bg-brand-foreground text-white"
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
