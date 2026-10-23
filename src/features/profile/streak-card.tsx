import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { monthKeyOf, monthLabel, shiftMonth } from "@/features/matches/logic";
import { cn } from "@/lib/utils";
import { playedDaysQueryOptions } from "./server";
import { Shuttlecock } from "./shuttlecock";
import { computeStreak, dayKeyOf, monthCalendar, weekOfDay, type CalendarCell } from "./streak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const FLAME_PATH =
  "M12 1c.8 4 7.5 7.4 7.5 14.5a7.5 7.5 0 0 1-15 0c0-2.6 1.1-4.6 2.6-6 .2 2.2 1.1 3.6 2.4 3.6C9 8.6 10 4 12 1Z";

/** The streak flame with its week count. Wobbles once on load, and on hover or tap. */
function StreakFlame({ weeks, active }: { weeks: number; active: boolean }) {
  const [wobble, setWobble] = useState(false);
  useEffect(() => setWobble(true), []);
  return (
    <div
      className={cn(
        "relative -my-3 h-[4.25rem] w-12 shrink-0",
        active ? "text-brand-foreground" : "text-muted-foreground/50",
      )}
      onPointerEnter={() => setWobble(true)}
      onClick={() => setWobble(true)}
    >
      <svg
        viewBox="0 0 24 28"
        fill="currentColor"
        className={cn("h-full w-full", wobble && "flame-wobble")}
        onAnimationEnd={() => setWobble(false)}
        aria-hidden
      >
        <path d={FLAME_PATH} />
      </svg>
      <span className="absolute inset-x-0 top-[60%] -translate-y-1/2 text-center text-sm font-bold leading-none text-white">
        {weeks}
      </span>
    </div>
  );
}

const PILL_FLAME_PATH =
  "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4";

/**
 * The streak pill in the top bar: flame + weeks. Tapping it opens the streak board
 * (a month calendar of the days played) as a bottom sheet.
 */
export function StreakNav() {
  const { data: playedDays } = useQuery(playedDaysQueryOptions());
  const [wobble, setWobble] = useState(false);
  useEffect(() => setWobble(true), []);
  if (!playedDays) return null;

  const streak = computeStreak(playedDays, dayKeyOf(new Date()));
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Streak: ${streak.weeks} ${streak.weeks === 1 ? "week" : "weeks"}. Open streak board`}
          onPointerEnter={() => setWobble(true)}
          className="-my-1 flex h-11 items-center"
        >
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full py-1 pl-1.5 pr-2.5 text-sm font-bold text-white transition-transform active:scale-95 motion-reduce:active:scale-100",
              streak.doneThisWeek ? "bg-brand-foreground" : "bg-white/20",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("h-5 w-5", wobble && "flame-wobble")}
              onAnimationEnd={() => setWobble(false)}
              aria-hidden
            >
              <path d={PILL_FLAME_PATH} />
            </svg>
            {streak.weeks}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="sr-only">Your weekly streak</DialogTitle>
        <StreakBoard playedDays={playedDays} />
      </DialogContent>
    </Dialog>
  );
}

/** Weekly streak: a month calendar marking the days the player actually played. */
function StreakBoard({ playedDays }: { playedDays: string[] }) {
  const now = new Date();
  const todayKey = dayKeyOf(now);
  const thisMonth = monthKeyOf(now);
  const [month, setMonth] = useState(thisMonth);

  const played = new Set(playedDays);
  const streak = computeStreak(playedDays, todayKey);
  const weeks = monthCalendar(month);
  const currentWeek = weekOfDay(todayKey);
  const playedWeeks = new Set(playedDays.map(weekOfDay));
  // The flame takes the place of the tick for the latest week in the streak
  const flameWeek = streak.weeks > 0 ? (streak.doneThisWeek ? currentWeek : currentWeek - 1) : null;
  const inStreak = (w: number | undefined) =>
    w !== undefined && flameWeek !== null && w <= flameWeek && w > flameWeek - streak.weeks;

  return (
    // Same width the old profile card had, so the dates keep their spacing inside the wider sheet
    <div className="mx-auto w-full max-w-[21rem] space-y-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Your Streak</p>
          <p className="text-xl font-semibold">
            {streak.weeks} {streak.weeks === 1 ? "Week" : "Weeks"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Sessions</p>
          <p className="text-xl font-semibold">{played.size}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted [@media(hover:hover)]:hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="font-medium">{monthLabel(month)}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors active:bg-muted disabled:opacity-30 [@media(hover:hover)]:hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_1rem_3rem] items-center gap-y-1.5 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs text-muted-foreground">
            {d}
          </span>
        ))}
        <span className="col-start-9" />
        {weeks.map((week, idx) => (
          <WeekRow
            key={week.week}
            cells={week.cells}
            played={played}
            todayKey={todayKey}
            weekDone={playedWeeks.has(week.week)}
            isCurrent={week.week === currentWeek}
            band={
              inStreak(week.week)
                ? {
                    first: !inStreak(weeks[idx - 1]?.week),
                    last: !inStreak(weeks[idx + 1]?.week),
                    link: inStreak(weeks[idx + 1]?.week),
                  }
                : null
            }
            flame={
              week.week === flameWeek ? { weeks: streak.weeks, active: streak.doneThisWeek } : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  cells,
  played,
  todayKey,
  weekDone,
  isCurrent,
  band,
  flame,
}: {
  cells: CalendarCell[];
  played: Set<string>;
  todayKey: string;
  weekDone: boolean;
  isCurrent: boolean;
  /** Where this row sits in the streak: the lighter strip in the right-hand column. */
  band: { first: boolean; last: boolean; link: boolean } | null;
  flame: { weeks: number; active: boolean } | null;
}) {
  return (
    <>
      {cells.map((c) => {
        const didPlay = played.has(c.key);
        return (
          <div key={c.key} className="flex justify-center">
            <span
              aria-label={didPlay ? `Played on ${c.key}` : undefined}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[13px]",
                didPlay
                  ? "bg-foreground text-white"
                  : !c.inMonth
                    ? "text-muted-foreground/40"
                    : c.key > todayKey
                      ? "border border-foreground/25"
                      : c.key !== todayKey && "bg-muted",
                c.key === todayKey && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {didPlay ? <Shuttlecock outline className="h-5 w-5 rotate-[35deg]" /> : c.day}
            </span>
          </div>
        );
      })}
      <div className="col-start-9 flex justify-center self-stretch">
        <div
          className={cn(
            "flex w-12 items-center justify-center",
            // Each strip segment reaches 4px into the 6px row gap, so neighbours meet without a seam
            band && "bg-[hsl(316_35%_91%)] -my-1 py-1",
            band?.first && "-mt-2 rounded-t-full pt-2",
            band?.last && (flame ? "-mb-3 rounded-b-full pb-3" : "-mb-2 rounded-b-full pb-2"),
          )}
        >
          {flame ? (
            <StreakFlame weeks={flame.weeks} active={flame.active} />
          ) : weekDone ? (
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
      </div>
    </>
  );
}
