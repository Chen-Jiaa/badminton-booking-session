import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { monthKeyOf, monthLabel, shiftMonth } from "@/features/matches/logic";
import { cn } from "@/lib/utils";
import { playedDaysQueryOptions } from "./server";
import { Shuttlecock } from "./shuttlecock";
import { computeStreak, dayKeyOf, monthCalendar, weekOfDay, type CalendarCell } from "./streak";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const FLAME_PATH =
  "M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4";
const FAT_FLAME_PATH =
  "M12 1c.8 4 7.5 7.4 7.5 14.5a7.5 7.5 0 0 1-15 0c0-2.6 1.1-4.6 2.6-6 .2 2.2 1.1 3.6 2.4 3.6C9 8.6 10 4 12 1Z";

// PROTOTYPE: five ways to show the streak flame with its number. `?flame=a..e` picks one.
const FLAME_VARIANTS = [
  { id: "a", label: "A Fat" },
  { id: "b", label: "B Stack" },
  { id: "c", label: "C Pill" },
  { id: "d", label: "D Badge" },
  { id: "e", label: "E Beside" },
] as const;
type FlameVariant = (typeof FLAME_VARIANTS)[number]["id"];

/** The streak flame with its week count. Wobbles once on load, and on hover or tap. */
function StreakFlame({
  weeks,
  active,
  variant,
}: {
  weeks: number;
  active: boolean;
  variant: FlameVariant;
}) {
  const [wobble, setWobble] = useState(false);
  useEffect(() => setWobble(true), []);
  const fat = variant === "a";
  const icon = (className: string) => (
    <svg
      viewBox={fat ? "0 0 24 28" : "0 0 24 24"}
      fill="currentColor"
      stroke={fat ? "none" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className, wobble && "flame-wobble")}
      onAnimationEnd={() => setWobble(false)}
      aria-hidden
    >
      <path d={fat ? FAT_FLAME_PATH : FLAME_PATH} />
    </svg>
  );
  const tone = active ? "text-brand-foreground" : "text-muted-foreground/50";
  const hit = { onPointerEnter: () => setWobble(true), onClick: () => setWobble(true) };

  if (variant === "a")
    return (
      <div className={cn("relative -my-2 h-14 w-12", tone)} {...hit}>
        {icon("h-full w-full")}
        <span className="absolute inset-0 flex items-end justify-center pb-2 text-lg font-bold text-white">
          {weeks}
        </span>
      </div>
    );
  if (variant === "b")
    return (
      <div className={cn("-my-2 flex flex-col items-center leading-none", tone)} {...hit}>
        {icon("h-6 w-6")}
        <b className="text-xl">{weeks}</b>
      </div>
    );
  if (variant === "c")
    return (
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-full py-1 pl-1.5 pr-2.5 text-white",
          active ? "bg-brand-foreground" : "bg-muted-foreground/50",
        )}
        {...hit}
      >
        {icon("h-5 w-5")}
        <b className="text-base">{weeks}</b>
      </div>
    );
  if (variant === "d")
    return (
      <div className={cn("relative -my-2 h-12 w-11", tone)} {...hit}>
        {icon("h-full w-full")}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 bg-white px-1 text-xs font-bold",
            active ? "border-brand-foreground" : "border-muted-foreground/50",
          )}
        >
          {weeks}
        </span>
      </div>
    );
  return (
    <div className={cn("flex items-center", tone)} {...hit}>
      {icon("h-7 w-7")}
      <b className="text-2xl">{weeks}</b>
    </div>
  );
}

/** Weekly streak: a month calendar marking the days the player actually played. */
export function StreakCard() {
  const { data: playedDays } = useQuery(playedDaysQueryOptions());
  const now = new Date();
  const todayKey = dayKeyOf(now);
  const thisMonth = monthKeyOf(now);
  const [month, setMonth] = useState(thisMonth);
  const [variant, setVariant] = useState<FlameVariant>("b");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("flame");
    const found = FLAME_VARIANTS.find((f) => f.id === v);
    if (found) setVariant(found.id);
  }, []);

  if (!playedDays) return null;

  const played = new Set(playedDays);
  const streak = computeStreak(playedDays, todayKey);
  const weeks = monthCalendar(month);
  const currentWeek = weekOfDay(todayKey);
  const playedWeeks = new Set(playedDays.map(weekOfDay));
  // The flame takes the place of the tick for the latest week in the streak
  const flameWeek = streak.weeks > 0 ? (streak.doneThisWeek ? currentWeek : currentWeek - 1) : null;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-medium">
          {FLAME_VARIANTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setVariant(f.id)}
              className={cn(
                "flex-1 rounded-full px-1 py-1.5",
                variant === f.id ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-10">
          <div>
            <p className="text-sm text-muted-foreground">Your Streak</p>
            <p className="text-xl font-semibold">
              {streak.weeks} {streak.weeks === 1 ? "Week" : "Weeks"}
            </p>
          </div>
          <div>
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

        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_3.5rem] items-center gap-y-2 text-center">
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
              variant={variant}
              flame={
                week.week === flameWeek
                  ? { weeks: streak.weeks, active: streak.doneThisWeek }
                  : null
              }
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
  flame,
  variant,
}: {
  cells: CalendarCell[];
  played: Set<string>;
  todayKey: string;
  weekDone: boolean;
  isCurrent: boolean;
  flame: { weeks: number; active: boolean } | null;
  variant: FlameVariant;
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
                  ? "bg-brand-foreground text-white"
                  : !c.inMonth
                    ? "text-muted-foreground/40"
                    : c.key > todayKey
                      ? "border border-foreground/25"
                      : c.key !== todayKey && "bg-muted",
                c.key === todayKey && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {didPlay ? <Shuttlecock outline className="h-6 w-6 rotate-[35deg]" /> : c.day}
            </span>
          </div>
        );
      })}
      <div className="flex justify-center">
        {flame ? (
          <StreakFlame weeks={flame.weeks} active={flame.active} variant={variant} />
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
    </>
  );
}
