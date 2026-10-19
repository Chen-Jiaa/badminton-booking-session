import { createFileRoute, redirect } from "@tanstack/react-router";

// Rescues mangled shared links such as
// `/sessions/<id> Join our badminton session! https://…/sessions/<id>`, whose extra
// slashes stop them matching `/sessions/$id`. `sessions_.$id.tsx` strips the junk
// from the id itself.
export const Route = createFileRoute("/_app/sessions_/$id/$")({
  beforeLoad: ({ params: { id, _splat } }) => {
    // The splat also matches an empty tail, i.e. the clean URL itself
    if (!_splat) return;
    throw redirect({ to: "/sessions/$id", params: { id }, replace: true });
  },
});
