import { useEffect, useRef, useState, type CSSProperties } from "react";

/** A single stylized shuttlecock: feather skirt with a cork tip. */
function Shuttlecock() {
  return (
    <svg viewBox="0 0 24 28" width="18" height="21" fill="none" aria-hidden="true">
      <path
        d="M12 20 L6.5 4.5 L17.5 4.5 Z"
        fill="hsl(var(--background))"
        stroke="hsl(var(--brand-foreground))"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <line
        x1="12"
        y1="20"
        x2="9.2"
        y2="4.7"
        stroke="hsl(var(--brand-foreground))"
        strokeWidth="0.8"
      />
      <line
        x1="12"
        y1="20"
        x2="14.8"
        y2="4.7"
        stroke="hsl(var(--brand-foreground))"
        strokeWidth="0.8"
      />
      <circle cx="12" cy="21.2" r="3.2" fill="hsl(var(--brand-foreground))" />
    </svg>
  );
}

// Birdies fan upward in a wide, flat oval (wider than tall) from the button center.
const BIRDIES = [
  { tx: "0px", ty: "-72px", rStart: "0deg", rEnd: "0deg", dur: "1080ms" },
  { tx: "77px", ty: "-64px", rStart: "11deg", rEnd: "37deg", dur: "990ms" },
  { tx: "-77px", ty: "-64px", rStart: "-11deg", rEnd: "-37deg", dur: "990ms" },
  { tx: "130px", ty: "-44px", rStart: "19deg", rEnd: "63deg", dur: "920ms" },
  { tx: "-130px", ty: "-44px", rStart: "-19deg", rEnd: "-63deg", dur: "920ms" },
  { tx: "159px", ty: "-20px", rStart: "23deg", rEnd: "77deg", dur: "890ms" },
  { tx: "-159px", ty: "-20px", rStart: "-23deg", rEnd: "-77deg", dur: "890ms" },
  { tx: "164px", ty: "8px", rStart: "24deg", rEnd: "80deg", dur: "880ms" },
  { tx: "-164px", ty: "8px", rStart: "-24deg", rEnd: "-80deg", dur: "880ms" },
];

/** Burst of shuttlecocks fired when a player claims their spot. */
export function JoinBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {BIRDIES.map((b, i) => (
        <span
          key={i}
          className="birdie absolute left-0 top-0 block will-change-transform"
          style={
            {
              "--tx": b.tx,
              "--ty": b.ty,
              "--r-start": b.rStart,
              "--r-end": b.rEnd,
              "--dur": b.dur,
            } as CSSProperties
          }
        >
          <Shuttlecock />
        </span>
      ))}
    </div>
  );
}

/** Drives the join celebration: haptic tap plus a short-lived `celebrating` flag. */
export function useJoinCelebration() {
  const [celebrating, setCelebrating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function celebrateJoin() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // A little "birdie landing" tap-tap.
      navigator.vibrate?.([12, 28, 16]);
    }
    setCelebrating(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCelebrating(false), 1500);
  }

  return { celebrating, celebrateJoin };
}
