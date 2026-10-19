import { useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Crown, Flame } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./controls";
import {
  daysLeftInMonth,
  monthLabel,
  streak,
  winRate,
  type Standing,
  type StandingPerson,
} from "./logic";

type Board = "players" | "teams";

export interface LeaderboardData {
  month: string;
  currentMonth: string;
  firstMonth: string;
  players: Standing[];
  teams: Standing[];
}

const stagger = (i: number) => ({ animationDelay: `${Math.min(i, 12) * 40}ms` }) as CSSProperties;

/**
 * Monthly standings. Top players are ranked by points scored in every match they
 * played (any partner); top teams by wins together. The top three stand on a
 * podium, then a full table gives everyone's numbers and recent form.
 */
export function Leaderboard({
  data,
  meId,
  onMonthChange,
}: {
  data: LeaderboardData;
  meId: string | undefined;
  onMonthChange: (delta: number) => void;
}) {
  const [board, setBoard] = useState<Board>("players");
  const ranked = data[board];
  const isMine = (s: Standing) => !!meId && s.people.some((p) => p.id === meId);
  const meFirst = (people: StandingPerson[]) =>
    [...people].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));
  const nameOf = (p: StandingPerson) => (p.id === meId ? "You" : p.name);
  const names = (s: Standing) => meFirst(s.people).map(nameOf).join(" & ");

  // The card follows the tab: my record, or my best-ranked team
  const myIndex = ranked.findIndex(isMine);
  const mine = ranked[myIndex];
  const partner = board === "teams" && mine ? mine.people.find((p) => p.id !== meId) : undefined;

  const inProgress = data.month === data.currentMonth;
  const final = !inProgress;
  const daysLeft = daysLeftInMonth(data.month);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Leaderboard</h1>

      {/* Month switcher: every month keeps its own final standings */}
      <div className="flex items-center justify-between rounded-xl border bg-white px-2 py-2">
        <button
          type="button"
          aria-label="Previous month"
          disabled={data.month <= data.firstMonth}
          onClick={() => onMonthChange(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,scale] hover:bg-accent active:scale-[0.94] disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">{monthLabel(data.month)}</p>
          <p className="text-xs text-muted-foreground">
            {inProgress
              ? `In progress · resets in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
              : "Final standings"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next month"
          disabled={data.month >= data.currentMonth}
          onClick={() => onMonthChange(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,scale] hover:bg-accent active:scale-[0.94] disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* My month at a glance, for whichever board is showing */}
      {meId && mine && (
        <div
          key={`card-${data.month}-${board}`}
          className="rise-in flex items-center gap-3 rounded-xl bg-brand/40 px-4 py-3 text-brand-foreground"
        >
          <div className="min-w-16 text-center">
            <p className="text-2xl font-bold leading-none tabular-nums">
              {myIndex >= 0 ? `#${myIndex + 1}` : "–"}
            </p>
            <p className="mt-1 max-w-20 truncate text-[11px] font-medium">
              {partner ? `with ${partner.name}` : "your rank"}
            </p>
          </div>
          <div className="h-8 w-px bg-brand-foreground/20" />
          <div className="flex flex-1 justify-around text-center text-sm">
            {board === "players" && <Stat value={String(mine.points)} label="points" />}
            <Stat value={`${mine.wins}–${mine.losses}`} label="W–L" />
            {board === "teams" && <Stat value={`${winRate(mine)}%`} label="win rate" />}
            <Stat
              value={streak(mine) >= 3 ? `${streak(mine)}🔥` : String(streak(mine))}
              label="streak"
            />
          </div>
        </div>
      )}

      <Tabs value={board} onValueChange={(v) => setBoard(v as Board)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="players">Top players</TabsTrigger>
          <TabsTrigger value="teams">Top teams</TabsTrigger>
        </TabsList>
      </Tabs>

      {ranked.length === 0 ? (
        <div className="rounded-xl border bg-white px-4 py-10 text-center">
          <p className="font-semibold">No rankings yet</p>
        </div>
      ) : (
        // Keyed so switching month or board replays the entrance
        <div key={`${data.month}-${board}`} className="space-y-3">
          <Podium
            ranked={ranked}
            board={board}
            final={final}
            names={names}
            meFirst={meFirst}
            isMine={isMine}
          />
          <StandingsTable
            ranked={ranked}
            board={board}
            myIndex={myIndex}
            meFirst={meFirst}
            nameOf={nameOf}
          />
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand-foreground/70" /> win
              <span className="ml-1 h-2 w-2 rounded-sm bg-gray-200" /> loss · newest on the right
            </span>
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3 text-warning" /> wins in a row
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-bold tabular-nums">{value}</p>
      <p className="text-[11px] opacity-80">{label}</p>
    </div>
  );
}

function StreakBadge({ s }: { s: Standing }) {
  const n = streak(s);
  if (n < 3) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">
      <Flame className="h-3 w-3" />
      {n}
    </span>
  );
}

function Podium({
  ranked,
  board,
  final,
  names,
  meFirst,
  isMine,
}: {
  ranked: Standing[];
  board: Board;
  final: boolean;
  names: (s: Standing) => string;
  meFirst: (people: StandingPerson[]) => StandingPerson[];
  isMine: (s: Standing) => boolean;
}) {
  const [first, second, third] = ranked;
  // Shown 2-1-3; first place rises last for a little drama
  const steps = [
    { s: second, place: 2, height: "h-20", delay: 0 },
    { s: first, place: 1, height: "h-28", delay: 160 },
    { s: third, place: 3, height: "h-16", delay: 80 },
  ];
  const plural = first && (first.people.length > 1 || isMine(first));

  return (
    <>
      <div className="grid grid-cols-3 items-end gap-2 pt-4">
        {steps.map(({ s, place, height, delay }) =>
          s ? (
            <div
              key={place}
              className="rise-in flex min-w-0 flex-col items-center gap-1.5"
              style={{ animationDelay: `${delay}ms` }}
            >
              <div className="relative">
                {place === 1 && (
                  <Crown className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-brand-foreground" />
                )}
                <AvatarStack
                  people={meFirst(s.people)}
                  className={place === 1 ? "h-14 w-14" : "h-11 w-11"}
                />
              </div>
              <p
                className={cn(
                  "w-full truncate text-center text-xs font-semibold",
                  isMine(s) && "text-brand-foreground",
                )}
              >
                {names(s)}
              </p>
              <div
                className={cn(
                  "flex w-full flex-col items-center justify-start rounded-t-lg pt-2",
                  height,
                  place === 1 ? "bg-brand" : "bg-brand/40",
                )}
              >
                <span className="text-lg font-bold text-brand-foreground">{place}</span>
                <span className="text-[11px] tabular-nums text-brand-foreground/80">
                  {board === "players" ? `${s.points} pts` : `${s.wins} wins`}
                </span>
              </div>
            </div>
          ) : (
            <div key={place} />
          ),
        )}
      </div>
      {final && first && (
        <p className="text-center text-xs font-medium text-brand-foreground">
          🏆 {names(first)} {plural ? "were" : "was"} {plural ? "champions" : "champion"} this month
        </p>
      )}
    </>
  );
}

function StandingsTable({
  ranked,
  board,
  myIndex,
  meFirst,
  nameOf,
}: {
  ranked: Standing[];
  board: Board;
  myIndex: number;
  meFirst: (people: StandingPerson[]) => StandingPerson[];
  nameOf: (p: StandingPerson) => string;
}) {
  const cols = "grid grid-cols-[1.5rem_1fr_2.25rem_1.75rem_1.75rem_4.25rem] items-center gap-x-1.5";
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div
        className={cn(
          cols,
          "border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        )}
      >
        <span>#</span>
        <span>{board === "players" ? "Player" : "Team"}</span>
        <span className="text-right">{board === "players" ? "Pts" : "%"}</span>
        <span className="text-right">W</span>
        <span className="text-right">L</span>
        <span className="text-right">Last 5</span>
      </div>
      {ranked.map((s, i) => (
        <div
          key={s.people.map((p) => p.id).join(":")}
          className={cn(
            cols,
            "rise-in border-b px-3 py-2 text-sm last:border-b-0",
            i === myIndex && "bg-brand/25",
            // A line under the podium places
            i === 2 && "border-b-brand-foreground/30",
          )}
          style={stagger(i + 3)}
        >
          <span
            className={cn(
              "font-semibold tabular-nums",
              i < 3 ? "text-brand-foreground" : "text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          {/* No avatars here (the podium has the faces); teams stack one name per line */}
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "flex min-w-0 flex-col leading-tight",
                i === myIndex && "font-semibold",
              )}
            >
              {meFirst(s.people).map((p) => (
                <span key={p.id} className="truncate">
                  {nameOf(p)}
                </span>
              ))}
            </span>
            <StreakBadge s={s} />
          </span>
          {/* The ranking column is bold */}
          {board === "players" ? (
            <span className="text-right font-semibold tabular-nums">{s.points}</span>
          ) : (
            <span className="text-right text-muted-foreground tabular-nums">{winRate(s)}</span>
          )}
          <span
            className={cn(
              "text-right tabular-nums",
              board === "teams" ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {s.wins}
          </span>
          <span className="text-right text-muted-foreground tabular-nums">{s.losses}</span>
          <span
            className="flex justify-end gap-0.5"
            aria-label={`Last results: ${s.form.slice(-5)}`}
          >
            {s.form
              .slice(-5)
              .split("")
              .map((r, j) => (
                <span
                  key={j}
                  className={cn(
                    "h-2.5 w-2.5 rounded-sm",
                    r === "W" ? "bg-brand-foreground/70" : "bg-gray-200",
                  )}
                />
              ))}
          </span>
        </div>
      ))}
    </div>
  );
}
