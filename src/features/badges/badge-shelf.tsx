// The "Badges" section of the profile page: medals in two groups, tap one for the popup.
import { useState } from "react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { cn } from "@/lib/utils";
import { AwardScreen } from "./award-screen";
import { MedalFace } from "./badge-medal";
import { BADGE_GROUPS, BADGES, type BadgeId } from "./catalog";
import { myBadgesQueryOptions } from "./server";

export function BadgeShelf() {
  const { data } = useSuspenseQueryDeferred(myBadgesQueryOptions());
  const [openId, setOpenId] = useState<BadgeId | null>(null);
  const byId = new Map(data.map((b) => [b.id, b]));
  const countOf = (id: BadgeId) => byId.get(id)?.count ?? 0;
  // Badges you can no longer earn (Founding Member) are hidden rather than shown locked
  const shown = BADGES.filter((b) => !b.hiddenUntilEarned || countOf(b.id) > 0);
  const earned = data.filter((b) => b.count > 0).length;

  return (
    <section className="space-y-3" aria-label="Badges">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight">Badges</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {earned} of {shown.length}
        </p>
      </div>
      {BADGE_GROUPS.map((group) => (
        <div key={group} className="space-y-1">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </h3>
          <div className="grid grid-cols-3 gap-x-1 gap-y-3 rounded-xl border bg-white p-2 pb-3">
            {shown
              .filter((b) => b.group === group)
              .map((b) => {
                const count = countOf(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setOpenId(b.id)}
                    className="flex flex-col items-center gap-2 rounded-xl p-1.5 text-center transition-[scale] active:scale-[0.96] motion-reduce:active:scale-100"
                  >
                    <MedalFace b={b} count={count} size={80} />
                    <span
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        count === 0 && "text-muted-foreground",
                      )}
                    >
                      {b.name}
                      <span className="sr-only">
                        {count > 0 ? `, ${count} ${b.unit}` : ", locked"}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <AwardScreen
        badge={openId ? (byId.get(openId) ?? null) : null}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}
