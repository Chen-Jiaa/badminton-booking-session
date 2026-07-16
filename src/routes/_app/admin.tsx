import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    if (context.user?.role !== "HOST") throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
