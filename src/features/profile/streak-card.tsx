import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { monthKeyOf, monthLabel, shiftMonth } from "@/features/matches/logic";
import { cn } from "@/lib/utils";
import { playedDaysQueryOptions } from "./server";
import { Shuttlecock } from "./shuttlecock";
import { computeStreak, dayKeyOf, monthCalendar, weekOfDay, type CalendarCell } from "./streak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Weekly streak: a month calendar marking the days the player actually played. */
export function StreakCard() {
  const { data: playedDays } = useQuery(playedDaysQueryOptions());
  const now = new Date();
  const todayKey = dayKeyOf(now);
  const thisMonth = monthKeyOf(now);
  const [month, setMonth] = useState(thisMonth);

  if (!playedDays) return null;

  const played = new Set(playedDays);
  const streak = computeStreak(playedDays, todayKey);
  const weeks = monthCalendar(month);
  const currentWeek = weekOfDay(todayKey);
  const playedWeeks = new Set(playedDays.map(weekOfDay));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "relative flex h-14 w-12 shrink-0 items-center justify-center",
                streak.doneThisWeek ? "text-brand-foreground" : "text-muted-foreground/50",
              )}
            >
              <Flame className="h-full w-full" fill="currentColor" strokeWidth={1} aria-hidden />
              <span className="absolute inset-0 flex items-end justify-center pb-2 text-lg font-bold text-white">
                {streak.weeks}
              </span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your streak</p>
              <p className="text-xl font-semibold">
                {streak.weeks} {streak.weeks === 1 ? "week" : "weeks"}
              </p>
              <p className="text-xs text-muted-foreground">
                {streak.doneThisWeek
                  ? "This week's done"
                  : streak.weeks > 0
                    ? "Play this week to keep it going"
                    : "Play a session to start one"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Sessions</p>
            <p className="text-xl font-semibold">{streak.activities}</p>
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

        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_2rem] items-center gap-y-2 text-center">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              {d}
            </span>
          ))}
          <span />
          {weeks.map((week) => (
            <WeekRow
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

function WeekRow({
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
      {cells.map((c) => {
        const didPlay = played.has(c.key);
        return (
          <div key={c.key} className="flex justify-center">
            <span
              aria-label={didPlay ? `Played on ${c.key}` : undefined}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm",
                didPlay
                  ? "text-brand-foreground"
                  : c.inMonth
                    ? "bg-muted"
                    : "text-muted-foreground/40",
                c.key === todayKey && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {didPlay ? <Shuttlecock outline className="h-6 w-6 rotate-[35deg]" /> : c.day}
            </span>
          </div>
        );
      })}
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
