// The badge on its plate, with the lifetime number in a pill at the bottom.
import { Lock } from "lucide-react";
import { BadgeArt } from "./art";
import type { BadgeDef } from "./catalog";

/** `count` is 0 while the badge is locked. The pill hides on big medals (the popup shows the number itself). */
export function MedalFace({ b, count, size = 72 }: { b: BadgeDef; count: number; size?: number }) {
  const earned = count > 0;
  const showCount = earned && !b.oneOff && size < 150;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <BadgeArt b={b} size={size} locked={!earned} />
      {showCount && (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full font-extrabold leading-none tabular-nums text-white"
          style={{
            bottom: -size * 0.04,
            fontSize: Math.max(11, size * 0.17),
            padding: `${size * 0.04}px ${size * 0.09}px`,
            background: `hsl(${b.hue} 35% 11%)`,
            boxShadow: `0 0 0 ${Math.max(1.5, size * 0.02)}px hsl(${b.hue} 85% 66%), 0 2px 6px rgba(0,0,0,.45)`,
          }}
        >
          {count}
        </span>
      )}
      {!earned && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2931] ring-1 ring-white/20"
        >
          <Lock className="h-3 w-3 text-white/60" />
        </span>
      )}
    </span>
  );
}
