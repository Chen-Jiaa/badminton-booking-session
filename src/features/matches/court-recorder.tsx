import { useState } from "react";
import { Loader2, Minus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PersonAvatar, Segmented, TickNumber, clampScore } from "./controls";
import { scoreProblem, type MatchFormat, type Side } from "./logic";

export interface Attendee {
  id: string;
  name: string;
  image: string | null;
}

export interface MatchDraft {
  format: MatchFormat;
  partnerId: string | null;
  opponentIds: string[];
  /** null: not played yet, goes out as an invite. */
  score: [number, number] | null;
}

type Slot = { side: Side; index: number };

/**
 * A top-down court is the form. Drop players from the bench onto each half,
 * then type each side's score, or tap a half to give it a point like a scoreboard.
 * Side A (near side) is always the recorder's.
 */
export function CourtRecorder({
  open,
  onOpenChange,
  me,
  attendees,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: Attendee;
  /** Everyone else going to this session. */
  attendees: Attendee[];
  submitting: boolean;
  onSubmit: (draft: MatchDraft) => void;
}) {
  const [format, setFormat] = useState<MatchFormat>("DOUBLES");
  const [sideA, setSideA] = useState<(string | null)[]>([me.id, null]);
  const [sideB, setSideB] = useState<(string | null)[]>([null, null]);
  const [target, setTarget] = useState<Slot | null>(null);
  const [finished, setFinished] = useState<"DONE" | "LATER">("DONE");
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [typing, setTyping] = useState<Side | null>(null);

  const people = new Map([me, ...attendees].map((p) => [p.id, p]));
  const nameOf = (id: string) => (id === me.id ? "You" : (people.get(id)?.name ?? "Unknown"));

  const size = format === "DOUBLES" ? 2 : 1;
  const a = sideA.slice(0, size);
  const b = sideB.slice(0, size);
  const placed = new Set([...a, ...b].filter((x): x is string => !!x));
  const bench = attendees.filter((p) => !placed.has(p.id));
  const teamsReady = a.every(Boolean) && b.every(Boolean);
  const scoring = finished === "DONE";
  const problem = scoring ? scoreProblem(score[0], score[1]) : null;
  const canSubmit = teamsReady && !problem && !submitting;

  // Where the next bench tap lands: the slot the user picked, else the first gap.
  const firstEmpty: Slot | null =
    a.indexOf(null) >= 0
      ? { side: "A", index: a.indexOf(null) }
      : b.indexOf(null) >= 0
        ? { side: "B", index: b.indexOf(null) }
        : null;
  const landing = target ?? firstEmpty;

  function place(id: string) {
    if (!landing) return;
    const set = landing.side === "A" ? setSideA : setSideB;
    set((s) => s.map((x, i) => (i === landing.index ? id : x)));
    setTarget(null);
  }

  function tapSlot(slot: Slot, id: string | null) {
    if (id === me.id) return;
    if (id) {
      const set = slot.side === "A" ? setSideA : setSideB;
      set((s) => s.map((x, i) => (i === slot.index ? null : x)));
    }
    setTarget(slot);
  }

  function setSideScore(side: Side, n: number) {
    const v = clampScore(n);
    setScore(([x, y]) => (side === "A" ? [v, y] : [x, v]));
  }

  function point(side: Side, delta: number) {
    if (!scoring || !teamsReady) return;
    navigator.vibrate?.(8);
    setScore(([x, y]) => (side === "A" ? [clampScore(x + delta), y] : [x, clampScore(y + delta)]));
  }

  function submit() {
    const ids = (s: (string | null)[]) => s.filter((x): x is string => !!x);
    onSubmit({
      format,
      partnerId: format === "DOUBLES" ? (ids(a)[1] ?? null) : null,
      opponentIds: ids(b),
      score: scoring ? score : null,
    });
  }

  const oppNames = b
    .filter((x): x is string => !!x)
    .map(nameOf)
    .join(" & ");
  const leader: Side | null = score[0] === score[1] ? null : score[0] > score[1] ? "A" : "B";

  const half = (side: Side, ids: (string | null)[]) => {
    const value = side === "A" ? score[0] : score[1];
    const live = scoring && teamsReady;
    const whose = side === "A" ? "your side" : "opponents";
    return (
      <div
        role={live ? "button" : undefined}
        aria-label={live ? `Point to ${whose}` : undefined}
        onClick={() => point(side, 1)}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-3 transition-colors duration-200",
          live && "cursor-pointer active:bg-brand/40",
          live && leader === side && "bg-brand/30",
        )}
      >
        {/* Centre and service lines */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-brand-foreground/15" />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 h-px bg-brand-foreground/15",
            side === "B" ? "bottom-[22%]" : "top-[22%]",
          )}
        />

        {scoring && (
          <div className="relative flex items-center gap-1 text-5xl font-bold text-brand-foreground">
            {live && typing === side ? (
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                aria-label={`Score for ${whose}`}
                defaultValue={value || ""}
                placeholder="0"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const n = digits ? clampScore(parseInt(digits, 10)) : 0;
                  // Show the capped value, so "45" reads as the 30 that gets sent
                  e.target.value = digits ? String(n) : "";
                  setSideScore(side, n);
                  // Two digits means they're done: hop to the other half if it's still blank
                  if (digits.length === 2) {
                    const other: Side = side === "B" ? "A" : "B";
                    setTyping((other === "A" ? score[0] : score[1]) === 0 ? other : null);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && setTyping(null)}
                onBlur={() => setTyping((t) => (t === side ? null : t))}
                className="h-16 w-24 rounded-xl border-2 border-brand-foreground/40 bg-white text-center text-5xl font-bold tabular-nums text-brand-foreground caret-brand-foreground outline-none placeholder:text-brand-foreground/25"
              />
            ) : (
              <button
                type="button"
                disabled={!live}
                aria-label={`Type score for ${whose}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTyping(side);
                }}
                className="flex h-16 min-w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-brand-foreground/25 bg-white/60 px-2 tabular-nums transition-[border-color,scale] duration-150 hover:border-brand-foreground/50 active:scale-[0.97] disabled:border-transparent disabled:bg-transparent"
              >
                <TickNumber value={value} />
              </button>
            )}
            {live && leader === side && score[0] + score[1] > 0 && (
              <Trophy className="join-pop pointer-events-none absolute -right-7 h-5 w-5" />
            )}
          </div>
        )}

        <div className="relative flex gap-6">
          {ids.map((id, i) => {
            const isTarget = landing?.side === side && landing.index === i;
            const person = id ? people.get(id) : undefined;
            return (
              <button
                key={`${side}-${i}-${id ?? "empty"}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  tapSlot({ side, index: i }, id);
                }}
                className="flex w-16 flex-col items-center gap-1"
              >
                {person ? (
                  <span className="slot-fill">
                    <PersonAvatar person={person} ring className="h-12 w-12 shadow-sm" />
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed bg-white/70 text-lg text-muted-foreground transition-colors",
                      isTarget
                        ? "border-brand-foreground text-brand-foreground"
                        : "border-gray-300",
                    )}
                  >
                    +
                  </span>
                )}
                <span className="w-full truncate text-center text-[11px] font-medium leading-none">
                  {id ? nameOf(id) : side === "A" ? "Partner" : "Opponent"}
                </span>
              </button>
            );
          })}
        </div>

        {live && (
          <button
            type="button"
            aria-label={`Remove a point from ${whose}`}
            onClick={(e) => {
              e.stopPropagation();
              point(side, -1);
            }}
            className={cn(
              "absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-muted-foreground shadow-sm transition-[scale] active:scale-[0.94]",
              side === "B" ? "top-2" : "bottom-2",
            )}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] gap-4 px-4 focus:outline-none">
        <DialogTitle className="text-center">Record match</DialogTitle>
        <DialogDescription className="sr-only">
          Put players on the court and enter the score. Your opponents confirm it before it counts.
        </DialogDescription>

        <div className="grid grid-cols-2 gap-2">
          <Segmented
            value={format}
            onChange={(f) => {
              setFormat(f);
              setTarget(null);
            }}
            options={[
              { value: "SINGLES", label: "1v1" },
              { value: "DOUBLES", label: "2v2" },
            ]}
          />
          <Segmented
            value={finished}
            onChange={setFinished}
            options={[
              { value: "DONE", label: "Final" },
              { value: "LATER", label: "Invite" },
            ]}
          />
        </div>

        {/* The court: opponents across the net, you on the near side */}
        <div className="relative mx-auto flex aspect-[4/5] w-full max-w-xs flex-col overflow-hidden rounded-lg border-2 border-brand-foreground/30 bg-brand/15">
          {half("B", b)}
          <div aria-hidden className="relative h-0">
            <div className="absolute inset-x-[-4px] top-1/2 h-1.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,hsl(var(--brand-foreground)/0.55)_0_3px,transparent_3px_6px)]" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 text-[11px] font-bold tracking-widest text-brand-foreground">
              NET
            </span>
          </div>
          {half("A", a)}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {!teamsReady
            ? bench.length === 0
              ? "Nobody else is going to this session yet"
              : landing
                ? `Tap a player below to add them as ${landing.side === "A" ? "your partner" : "an opponent"}`
                : ""
            : scoring
              ? (problem ?? "Tap a score to type it, or tap a half for +1")
              : `${oppNames} will get an invite to accept`}
        </p>

        {/* Bench: everyone going to this session who isn't on court */}
        {!teamsReady && bench.length > 0 && (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => place(p.id)}
                className="flex w-14 shrink-0 flex-col items-center gap-1 transition-[scale] duration-150 active:scale-[0.94]"
              >
                <PersonAvatar person={p} className="h-11 w-11" />
                <span className="w-full truncate text-center text-[11px]">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        <Button variant="brand" size="cta" disabled={!canSubmit} onClick={submit}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="truncate">
            {!teamsReady
              ? "Fill the court"
              : scoring
                ? `Send ${score[0]}–${score[1]} to ${oppNames}`
                : `Invite ${oppNames}`}
          </span>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
