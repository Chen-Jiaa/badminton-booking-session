import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/topup")({
  beforeLoad: () => {
    throw redirect({ to: "/wallet" });
  },
});
