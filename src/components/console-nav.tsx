import { useLayoutEffect, useRef, useState } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CalendarDays, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/finance", icon: BarChart3, label: "Finance" },
  { href: "/admin/members", icon: Users, label: "Members" },
  {
    href: "/admin/sessions",
    icon: CalendarDays,
    label: "Sessions",
    badgeKey: "lateCancels" as const,
  },
  { href: "/admin/topups", icon: Wallet, label: "Transactions", badgeKey: "pending" as const },
] satisfies {
  href: string;
  icon: typeof Users;
  label: string;
  badgeKey?: "pending" | "lateCancels";
}[];

interface ConsoleNavProps {
  pendingCount?: number;
  lateCancelCount?: number;
}

/**
 * Back-office navigation. Renders as a left rail on desktop and a scrollable
 * strip under the header on phones — the console is a desktop-first surface,
 * but the accountant still opens it on their phone.
 */
export function ConsoleNav({ pendingCount = 0, lateCancelCount = 0 }: ConsoleNavProps) {
  const matchRoute = useMatchRoute();
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const activeIndex = items.findIndex((item) => !!matchRoute({ to: item.href, fuzzy: true }));

  // Measure the active link so the pill can slide between differently sized items
  useLayoutEffect(() => {
    const measure = () => {
      const el = linkRefs.current[activeIndex];
      setPill(
        el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null,
      );
    };
    measure();
    const frame = requestAnimationFrame(() => setAnimate(true)); // no slide on first paint
    const ro = new ResizeObserver(measure);
    if (navRef.current) ro.observe(navRef.current);
    // Items can change width without the nav resizing (badge appears, webfont swaps in)
    linkRefs.current.forEach((el) => el && ro.observe(el));
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [activeIndex]);

  return (
    <nav
      ref={navRef}
      className="relative flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
    >
      {/* Sliding active indicator */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 rounded-lg bg-brand/30",
          animate &&
            "transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        )}
        style={{
          width: pill?.w ?? 0,
          height: pill?.h ?? 0,
          transform: `translate(${pill?.x ?? 0}px, ${pill?.y ?? 0}px)`,
          opacity: pill ? 1 : 0,
        }}
      />
      {items.map((item, i) => {
        const isActive = !!matchRoute({ to: item.href, fuzzy: true });
        const badge =
          item.badgeKey === "pending"
            ? pendingCount
            : item.badgeKey === "lateCancels"
              ? lateCancelCount
              : 0;

        return (
          <Link
            key={item.href}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            to={item.href}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.97]",
              isActive
                ? "text-brand-foreground"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            {badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      {/* Desktop only (phones get a back button in the header). The divider lives on
          the wrapper so the hover fill matches the other items */}
      <div className="hidden shrink-0 lg:mt-4 lg:block lg:border-t lg:border-gray-200 lg:pt-3">
        <Link
          to="/sessions"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-[color,background-color,scale] duration-150 hover:bg-gray-100 hover:text-gray-900 active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to app</span>
        </Link>
      </div>
    </nav>
  );
}
