import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { SessionForm } from "@/features/admin/session-form";
import { courtsQueryOptions } from "@/features/admin/server";

export const Route = createFileRoute("/_app/admin/sessions/new")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(courtsQueryOptions()),
  component: NewSessionPage,
});

function NewSessionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Create Session</h1>
      <Card>
        <CardContent className="pt-6">
          <SessionForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
