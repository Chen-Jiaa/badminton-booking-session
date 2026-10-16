import { Link, useMatchRoute } from "@tanstack/react-router";
import { Wallet, Calendar, Shield, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  userRole?: "PLAYER" | "HOST" | "ADMIN";
  pendingCount?: number;
  /** Matches waiting on this player to accept or confirm. */
  pendingMatchesCount?: number;
}

const playerNavItems = [
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
];

const hostNavItems = [
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/profile", icon: Shield, label: "Admin" },
];

export function BottomNav({
  userRole = "PLAYER",
  pendingCount = 0,
  pendingMatchesCount = 0,
}: BottomNavProps) {
  const matchRoute = useMatchRoute();
  const navItems = userRole === "ADMIN" ? hostNavItems : playerNavItems;
  const activeIndex = navItems.findIndex((item) => !!matchRoute({ to: item.href, fuzzy: true }));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-t border-black/5 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="container mx-auto max-w-lg">
        <div className="relative flex items-center py-2">
          {/* Sliding active indicator */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-2 left-0 px-2 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              width: `${100 / navItems.length}%`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          >
            <span className="block h-full w-full rounded-xl bg-brand/30" />
          </span>
          {navItems.map((item) => {
            const isActive = !!matchRoute({ to: item.href, fuzzy: true });
            const badge =
              item.label === "Admin"
                ? pendingCount
                : item.label === "Sessions"
                  ? pendingMatchesCount
                  : 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 px-1 py-2 rounded-xl transition-[color,background-color,scale] duration-150 active:scale-[0.96]",
                  isActive ? "text-brand-foreground" : "text-gray-500 hover:text-gray-700",
                )}
              >
                {/* Badge anchors to the icon, not the full-width cell */}
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white leading-none">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
