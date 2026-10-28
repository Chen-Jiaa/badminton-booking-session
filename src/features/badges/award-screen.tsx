// The full-screen "Award unlocked" view for one badge, opened from the shelf. Look borrowed
// from Apple Fitness awards: dark glow, big faded title, sparkles and a 3D medal you can
// tilt. Animation classes (.award-*) live in globals.css.
import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Lock, X } from "lucide-react";
import { PersonAvatar } from "@/features/matches/controls";
import { BadgeArt } from "./art";
import { badgeById, type BadgeDef } from "./catalog";
import type { MyBadge } from "./server";

const clamp = (n: number, max = 1) => Math.max(-max, Math.min(max, n));

/**
 * The big badge in the popup, in 3D. The dark plate stays back and the artwork floats in
 * front, so it shifts as it turns. Move the mouse anywhere on the screen and it follows
 * (up to 40 degrees); press and drag anywhere to spin it freely, and it settles back on
 * release. It sways gently until the first touch, to hint that it moves.
 */
function TiltBadge({ b, count, size }: { b: BadgeDef; count: number; size: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState(false);
  const [mode, setMode] = useState<"idle" | "hover" | "drag">("idle");
  const earned = count > 0;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // base = whole turns already spun, so settling back never unwinds them
    const pose = { rx: 0, ry: 0, base: 0 };
    let drag: { x: number; y: number; rx: number; ry: number } | null = null;
    const apply = () => {
      el.style.setProperty("--rx", `${pose.rx}deg`);
      el.style.setProperty("--ry", `${pose.ry}deg`);
    };
    const inAward = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("[data-award]") && !t.closest("button");

    const onMove = (e: PointerEvent) => {
      if (drag) {
        pose.ry = drag.ry + (e.clientX - drag.x) * 0.8;
        pose.rx = clamp(drag.rx - (e.clientY - drag.y) * 0.8, 80);
        apply();
      } else if (e.pointerType === "mouse") {
        const r = el.getBoundingClientRect();
        const nx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2));
        const ny = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
        pose.ry = pose.base + nx * 40;
        pose.rx = -ny * 40;
        apply();
        setMode("hover");
        setTouched(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!inAward(e.target)) return;
      drag = { x: e.clientX, y: e.clientY, rx: pose.rx, ry: pose.ry };
      setMode("drag");
      setTouched(true);
    };
    const settle = () => {
      if (!drag) return;
      drag = null;
      pose.base = Math.round(pose.ry / 360) * 360;
      pose.ry = pose.base;
      pose.rx = 0;
      apply();
      setMode("idle");
    };
    const rest = () => {
      pose.ry = pose.base;
      pose.rx = 0;
      apply();
      setMode("idle");
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", settle);
    document.addEventListener("pointercancel", settle);
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", settle);
      document.removeEventListener("pointercancel", settle);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, []);

  const ease =
    mode === "drag"
      ? "none"
      : mode === "hover"
        ? "120ms ease-out"
        : "650ms cubic-bezier(0.23, 1, 0.32, 1)";

  return (
    <div className="relative select-none" style={{ perspective: 800 }}>
      <div
        className={!touched && earned ? "award-sway" : undefined}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={stage}
          className="relative"
          style={{
            width: size,
            height: size,
            transformStyle: "preserve-3d",
            transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
            transition: ease === "none" ? "none" : `transform ${ease}`,
          }}
        >
          <div className="absolute inset-0">
            <BadgeArt b={b} size={size} showArt={false} locked={!earned} />
          </div>
          <div className="absolute inset-0" style={{ transform: "translateZ(46px)" }}>
            <BadgeArt b={b} size={size} plate={false} locked={!earned} />
          </div>
          {!earned && (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2931] ring-1 ring-white/20"
              style={{ transform: "translateZ(60px)" }}
            >
              <Lock className="h-4 w-4 text-white/60" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const SPARKLES = [
  { x: 14, y: 10, s: 10, d: 0 },
  { x: 78, y: 7, s: 14, d: 0.6 },
  { x: 90, y: 22, s: 8, d: 1.1 },
  { x: 6, y: 30, s: 8, d: 0.9 },
  { x: 24, y: 19, s: 6, d: 1.5 },
  { x: 66, y: 16, s: 7, d: 0.3 },
];

function AwardContent({ b, badge }: { b: BadgeDef; badge: MyBadge }) {
  const { count, earnedBy, holders } = badge;
  const earned = count > 0;
  const h = b.hue;
  return (
    <DialogPrimitive.Content
      data-award=""
      className="fixed inset-0 z-50 flex touch-none flex-col items-center overflow-hidden text-white outline-none"
      style={{
        background: earned
          ? `radial-gradient(ellipse 90% 55% at 50% 30%, hsl(${h} 55% 30%) 0%, hsl(${h} 40% 12%) 45%, #09080d 80%)`
          : "radial-gradient(ellipse 90% 55% at 50% 30%, #2d2c35 0%, #09080d 75%)",
      }}
    >
      {SPARKLES.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="award-twinkle absolute text-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.s * 1.6,
            animationDelay: `${p.d}s`,
            display: earned ? undefined : "none",
          }}
        >
          ✦
        </span>
      ))}

      <DialogPrimitive.Close
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-[scale,background-color] hover:bg-white/25 active:scale-[0.94]"
      >
        <X className="h-5 w-5" />
      </DialogPrimitive.Close>

      <p className="mt-16 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
        {earned ? "Badge unlocked" : "Badge locked"}
      </p>

      <div className="relative mt-4 flex w-full flex-1 flex-col items-center px-6 text-center">
        {/* Big faded name behind the medal */}
        <p
          aria-hidden
          className="award-title absolute inset-x-0 top-2 px-4 text-[52px] font-black leading-[0.95] tracking-tight"
          style={{ color: `hsl(${h} 60% 70% / .16)` }}
        >
          {b.name}
        </p>
        <div className="award-pop relative mt-10" style={{ transformStyle: "preserve-3d" }}>
          <TiltBadge b={b} count={count} size={196} />
        </div>

        <DialogPrimitive.Title
          className="award-rise mt-8 text-2xl font-bold"
          style={{ animationDelay: "120ms" }}
        >
          {b.name}
        </DialogPrimitive.Title>
        <DialogPrimitive.Description
          className="award-rise mt-2 max-w-xs text-sm leading-relaxed text-white/65"
          style={{ animationDelay: "180ms" }}
        >
          {earned ? b.blurb : `${b.blurb} It starts counting the first time you earn it.`}
        </DialogPrimitive.Description>

        {earned && !b.oneOff && (
          <p className="award-rise mt-4 text-sm" style={{ animationDelay: "240ms" }}>
            <span className="text-3xl font-extrabold tabular-nums">{count}</span>
            <span className="ml-2 text-white/60">{b.unit}</span>
          </p>
        )}

        <div
          className="award-rise mt-5 flex items-center gap-2 text-xs text-white/55"
          style={{ animationDelay: "300ms" }}
        >
          <span className="flex -space-x-1.5">
            {holders.map((p) => (
              <PersonAvatar
                key={p.id}
                person={p}
                className="h-6 w-6 text-[10px] ring-2 ring-[#15131b]"
              />
            ))}
          </span>
          {earnedBy === 0 ? "Nobody has earned this yet" : `Earned by ${earnedBy}% of members`}
        </div>
      </div>

      <div className="w-full px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <DialogPrimitive.Close className="h-12 w-full rounded-full bg-white text-sm font-semibold text-black transition-[scale] active:scale-[0.98]">
          See all badges
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  );
}

/** The popup for the tapped badge (`badge` null = closed). */
export function AwardScreen({ badge, onClose }: { badge: MyBadge | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={!!badge} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {badge && <AwardContent b={badgeById(badge.id)} badge={badge} />}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
