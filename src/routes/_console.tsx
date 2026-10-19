import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConsoleNav } from "@/components/console-nav";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { currentUserQueryOptions } from "@/features/auth/server";
import {
  adminSessionsQueryOptions,
  adminTopUpsQueryOptions,
  membersQueryOptions,
} from "@/features/admin/server";
import { adminWithdrawalsQueryOptions } from "@/features/withdrawal/server";
import { financeSummaryQueryOptions } from "@/features/finance/server";

/**
 * The back-office console. Deliberately a sibling of `_app` rather than a route
 * inside it: this is a wide, desktop-first working surface for admins, so it
 * gets its own chrome instead of the phone-width PWA shell and bottom nav.
 */
export const Route = createFileRoute("/_console")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions());
    if (user?.role !== "ADMIN") throw redirect({ to: "/" });
    return { user };
  },
  loader: ({ context: { queryClient } }) => {
    // Fire-and-forget: warm every console section on first entry
    queryClient.prefetchQuery(adminSessionsQueryOptions());
    queryClient.prefetchQuery(adminTopUpsQueryOptions());
    queryClient.prefetchQuery(adminWithdrawalsQueryOptions());
    queryClient.prefetchQuery(membersQueryOptions());
    queryClient.prefetchQuery(financeSummaryQueryOptions());
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const { data: user } = useSuspenseQueryDeferred(currentUserQueryOptions());

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-40 bg-black px-4 py-3 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Phones: an iOS-style back button where the thumb expects the way out.
                Desktop keeps "Back to profile" at the foot of the rail instead. */}
            <Link
              to="/profile"
              className="-my-1 -ml-2 flex min-h-11 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-sm font-medium text-brand transition-[opacity,scale] duration-100 active:scale-[0.97] active:opacity-60 lg:hidden"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>Profile</span>
            </Link>
            <span className="h-5 w-px bg-white/20 lg:hidden" aria-hidden />
            <span className="text-lg">🏸</span>
            <span className="font-semibold">Console</span>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
            <AvatarFallback className="bg-brand text-sm text-brand-foreground">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-8 lg:py-8">
        <aside className="lg:w-52 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <ConsoleNav
              pendingCount={(user?.pendingTopupsCount ?? 0) + (user?.pendingWithdrawalsCount ?? 0)}
              lateCancelCount={user?.pendingLateCancelsCount ?? 0}
            />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
