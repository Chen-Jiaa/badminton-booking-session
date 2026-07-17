import { createFileRoute, Outlet } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/features/auth/server";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header user={user} />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <Outlet />
      </main>
      <BottomNav userRole={user?.role} pendingTopupsCount={user?.pendingTopupsCount ?? 0} />
    </div>
  );
}
