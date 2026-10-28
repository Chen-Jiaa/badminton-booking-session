// "Attendance" tab of the leaderboard. Two ways to rank the same month:
// who turned up most, and who joins fastest after a session is posted.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar, Segmented } from "./controls";
import { BadgeChips } from "@/features/badges/badge-chips";
import { badgeChipsQueryOptions } from "@/features/badges/server";
import { attendanceQueryOptions } from "./server";
import { formatJoinTime, sortAttendance, type AttendanceSort } from "./attendance";

export function AttendanceBoard({ month, meId }: { month: string; meId: string | undefined }) {
  const [by, setBy] = useState<AttendanceSort>("attended");
  const { data } = useQuery(attendanceQueryOptions(month));
  const { data: badges } = useQuery(badgeChipsQueryOptions());

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (data.players.length === 0) {
    return (
      <div className="rounded-xl border bg-white px-4 py-10 text-center">
        <p className="font-semibold">No finalized sessions yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Attendance counts once a host finalizes a session.
        </p>
      </div>
    );
  }

  const ranked = sortAttendance(data.players, by);
  const myIndex = ranked.findIndex((p) => p.id === meId);
  const mine = ranked[myIndex];
  const cols = "grid grid-cols-[1.5rem_1fr_3.5rem_4rem] items-center gap-x-2";

  return (
    <div className="space-y-3">
      {mine && (
        <div className="rise-in flex items-center gap-3 rounded-xl bg-brand/40 px-4 py-3 text-brand-foreground">
          <div className="min-w-16 text-center">
            <p className="text-2xl font-bold leading-none tabular-nums">#{myIndex + 1}</p>
            <p className="mt-1 text-[11px] font-medium">your rank</p>
          </div>
          <div className="h-8 w-px bg-brand-foreground/20" />
          <div className="flex flex-1 justify-around text-center text-sm">
            <div>
              <p className="font-bold tabular-nums">
                {mine.attended}/{data.totalSessions}
              </p>
              <p className="text-[11px] opacity-80">sessions</p>
            </div>
            <div>
              <p className="font-bold tabular-nums">{formatJoinTime(mine.avgJoinMs)}</p>
              <p className="text-[11px] opacity-80">avg to join</p>
            </div>
            <div>
              <p className="font-bold tabular-nums">{formatJoinTime(mine.fastestJoinMs)}</p>
              <p className="text-[11px] opacity-80">fastest</p>
            </div>
          </div>
        </div>
      )}

      <Segmented
        value={by}
        onChange={setBy}
        options={[
          { value: "attended", label: "Most sessions" },
          { value: "speed", label: "Fastest to join" },
        ]}
      />

      <div key={by} className="overflow-hidden rounded-xl border bg-white">
        <div
          className={cn(
            cols,
            "border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
          )}
        >
          <span>#</span>
          <span>Player</span>
          <span className={cn("text-right", by === "attended" && "text-foreground")}>Played</span>
          <span className={cn("text-right", by === "speed" && "text-foreground")}>Avg join</span>
        </div>
        {ranked.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              cols,
              "rise-in border-b px-3 py-2 text-sm last:border-b-0",
              i === myIndex && "bg-brand/25",
            )}
            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
          >
            <span
              className={cn(
                "font-semibold tabular-nums",
                i < 3 ? "text-brand-foreground" : "text-muted-foreground",
              )}
            >
              {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar person={p} className="h-7 w-7 shrink-0" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className={cn("truncate", i === myIndex && "font-semibold")}>
                  {p.id === meId ? "You" : p.name}
                </span>
                <BadgeChips chips={badges?.[p.id]} max={1} />
              </span>
            </span>
            <span
              className={cn(
                "text-right tabular-nums",
                by === "attended" ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {p.attended}/{data.totalSessions}
            </span>
            <span
              className={cn(
                "text-right tabular-nums",
                by === "speed" ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {formatJoinTime(p.avgJoinMs)}
            </span>
          </div>
        ))}
      </div>
      <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        <Timer className="h-3 w-3" /> Join time = from the session being posted to your RSVP
      </p>
    </div>
  );
}
