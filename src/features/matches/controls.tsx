import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MAX_SCORE } from "./logic";

export interface PersonLike {
  name: string;
  image: string | null;
}

export function PersonAvatar({
  person,
  className,
  ring,
}: {
  person: PersonLike;
  className?: string;
  ring?: boolean;
}) {
  return (
    <Avatar className={cn("h-8 w-8", ring && "ring-2 ring-white", className)}>
      <AvatarImage src={person.image || undefined} alt="" />
      <AvatarFallback className="bg-brand text-brand-foreground text-xs font-semibold">
        {person.name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars for one side of a match or a doubles team. */
export function AvatarStack({ people, className }: { people: PersonLike[]; className?: string }) {
  return (
    <div className="flex shrink-0 -space-x-2">
      {people.map((p, i) => (
        <PersonAvatar key={i} person={p} ring className={className} />
      ))}
    </div>
  );
}

/** A number that rolls in from the direction it changed. */
export function TickNumber({ value, className }: { value: number; className?: string }) {
  const prev = useRef(value);
  const from = value >= prev.current ? "40%" : "-40%";
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <span
      key={value}
      className={cn("score-tick inline-block tabular-nums", className)}
      style={{ "--tick-from": from } as CSSProperties}
    >
      {value}
    </span>
  );
}

export const clampScore = (n: number) => Math.max(0, Math.min(MAX_SCORE, n));

/** Big +/- stepper; tapping the number lets you type it. */
export function ScoreStepper({
  value,
  onChange,
  label,
  emphasis,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  emphasis?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <p className="w-full truncate text-center text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clampScore(value - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border bg-background transition-[scale,background-color] duration-150 hover:bg-accent active:scale-[0.94]"
        >
          <Minus className="h-4 w-4" />
        </button>
        {editing ? (
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            aria-label={label}
            defaultValue={value}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange(clampScore(n));
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            // 16px+ keeps iOS from zooming on focus
            className="h-14 w-16 rounded-lg border text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-brand-foreground/30"
          />
        ) : (
          <button
            type="button"
            aria-label={`Type ${label}`}
            onClick={() => setEditing(true)}
            className={cn(
              "flex h-14 w-16 items-center justify-center overflow-hidden rounded-lg text-3xl font-bold transition-colors",
              emphasis ? "bg-brand text-brand-foreground" : "bg-muted",
            )}
          >
            <TickNumber value={value} />
          </button>
        )}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clampScore(value + 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border bg-background transition-[scale,background-color] duration-150 hover:bg-accent active:scale-[0.94]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Two-option segmented control with a sliding pill, in the app's muted style. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      className="relative grid rounded-md bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-sm bg-background shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 h-8 rounded-sm text-sm font-medium transition-colors",
            o.value === value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
