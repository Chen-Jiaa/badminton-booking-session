import { createFileRoute, Outlet } from "@tanstack/react-router";
import { fetchCurrentUserFn } from "@/features/auth/server";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await fetchCurrentUserFn();
    return { user };
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
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
