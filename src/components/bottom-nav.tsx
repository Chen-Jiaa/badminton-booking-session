import { Link, useMatchRoute } from "@tanstack/react-router";
import { Wallet, Calendar, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  userRole?: "PLAYER" | "HOST" | "ADMIN";
  pendingTopupsCount?: number;
}

const playerNavItems = [
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
];

const hostNavItems = [
  { href: "/sessions", icon: Calendar, label: "Sessions" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/profile", icon: Shield, label: "Admin" },
];

export function BottomNav({ userRole = "PLAYER", pendingTopupsCount = 0 }: BottomNavProps) {
  const matchRoute = useMatchRoute();
  const navItems = userRole === "ADMIN" ? hostNavItems : playerNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="container mx-auto max-w-lg">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = !!matchRoute({ to: item.href, fuzzy: true });
            const showBadge = item.label === "Admin" && pendingTopupsCount > 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  isActive ? "text-brand-foreground" : "text-gray-500 hover:text-gray-700",
                )}
              >
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                    {pendingTopupsCount}
                  </span>
                )}
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
