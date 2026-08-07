import { Link, useMatchRoute } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  // Finance is temporarily hidden from the nav; the /admin/finance route and its
  // code are kept intact. Restore this entry (and the BarChart3 import) to re-enable.
  // { href: "/admin/finance", icon: BarChart3, label: "Finance" },
  { href: "/admin/members", icon: Users, label: "Members" },
  { href: "/admin/sessions", icon: CalendarDays, label: "Sessions" },
  { href: "/admin/topups", icon: Wallet, label: "Transactions", badgeKey: "pending" as const },
] satisfies {
  href: string;
  icon: typeof Users;
  label: string;
  badgeKey?: "pending";
}[];

interface ConsoleNavProps {
  pendingCount?: number;
}

/**
 * Back-office navigation. Renders as a left rail on desktop and a scrollable
 * strip under the header on phones — the console is a desktop-first surface,
 * but the accountant still opens it on their phone.
 */
export function ConsoleNav({ pendingCount = 0 }: ConsoleNavProps) {
  const matchRoute = useMatchRoute();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const isActive = !!matchRoute({ to: item.href, fuzzy: true });
        const badge = item.badgeKey === "pending" ? pendingCount : 0;

        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand/30 text-brand-foreground"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            {badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}

      <Link
        to="/sessions"
        className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:mt-4 lg:border-t lg:border-gray-200 lg:pt-4"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span>Back to app</span>
      </Link>
    </nav>
  );
}
