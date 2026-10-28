// Small badge tags that sit under a name on the leaderboard, like the streak pill.
// A person's rarest badges come first; the rest collapse into "+N".
import { cn } from "@/lib/utils";
import { BadgeArt } from "./art";
import { badgeById, type BadgeCount } from "./catalog";

export function BadgeChip({ id, count }: BadgeCount) {
  const b = badgeById(id);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-[11px] font-semibold leading-none"
      style={{ background: `hsl(${b.hue} 90% 94%)`, color: `hsl(${b.hue} 55% 26%)` }}
    >
      <BadgeArt b={b} size={20} plate={false} />
      {b.name}
      {!b.oneOff && <span className="tabular-nums opacity-70">{count}</span>}
    </span>
  );
}

export function BadgeChips({
  chips,
  max = 2,
  className,
}: {
  chips: BadgeCount[] | undefined;
  max?: number;
  className?: string;
}) {
  if (!chips?.length) return null;
  const extra = chips.length - max;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {chips.slice(0, max).map((c) => (
        <BadgeChip key={c.id} {...c} />
      ))}
      {extra > 0 && <span className="text-[11px] font-medium text-muted-foreground">+{extra}</span>}
    </span>
  );
}
