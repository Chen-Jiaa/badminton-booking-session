import { createFileRoute, Outlet } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/features/auth/server";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { InstallCard } from "@/components/install-card";
import { walletQueryOptions } from "@/features/wallet/server";
import { sessionsQueryOptions } from "@/features/sessions/server";
import { profileQueryOptions } from "@/features/profile/server";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(currentUserQueryOptions()).then((user) => ({ user })),
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(walletQueryOptions());
    queryClient.prefetchQuery(sessionsQueryOptions());
    queryClient.prefetchQuery(profileQueryOptions());
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: user } = useSuspenseQueryDeferred(currentUserQueryOptions());

  return (
    <div
      className="min-h-dvh bg-gray-50"
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <Header user={user} />
      <main className="container mx-auto max-w-lg px-4 py-6">
        <InstallCard />
        <Outlet />
      </main>
      <BottomNav
        userRole={user?.role}
        pendingCount={(user?.pendingTopupsCount ?? 0) + (user?.pendingWithdrawalsCount ?? 0)}
        pendingMatchesCount={user?.pendingMatchesCount ?? 0}
      />
    </div>
  );
}
