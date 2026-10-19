import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { SessionForm } from "@/features/admin/session-form";
import { courtsQueryOptions, sessionTemplateQueryOptions } from "@/features/admin/server";

export const Route = createFileRoute("/_app/sessions_/new")({
  // ?from=<sessionId> duplicates that session; without it the form copies your last one
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" ? { from: search.from } : {},
  beforeLoad: ({ context }) => {
    if (context.user?.role !== "HOST" && context.user?.role !== "ADMIN") {
      throw redirect({ to: "/sessions" });
    }
  },
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ context: { queryClient }, deps: { from } }) =>
    Promise.all([
      queryClient.ensureQueryData(courtsQueryOptions()),
      queryClient.ensureQueryData(sessionTemplateQueryOptions(from)),
    ]),
  component: NewSessionPage,
});

function NewSessionPage() {
  const { user } = Route.useRouteContext();
  const { from } = Route.useSearch();
  const { data: template } = useSuspenseQuery(sessionTemplateQueryOptions(from));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Create Session</h1>
      <Card>
        <CardContent className="pt-6">
          <SessionForm
            key={from ?? "latest"}
            mode="create"
            template={template}
            canManageCourts={user?.role === "ADMIN"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
