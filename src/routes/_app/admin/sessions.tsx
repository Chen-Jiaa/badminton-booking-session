import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { adminSessionsQueryOptions } from "@/features/admin/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SessionList } from "@/features/admin/session-list";

export const Route = createFileRoute("/_app/admin/sessions")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSessionsQueryOptions()),
  component: AdminSessionsPage,
});

function AdminSessionsPage() {
  const { data: allSessions } = useSuspenseQueryDeferred(adminSessionsQueryOptions());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        <Link to="/admin/sessions/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
        </Link>
      </div>

      {allSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No sessions yet
          </CardContent>
        </Card>
      ) : (
        <SessionList sessions={allSessions} />
      )}
    </div>
  );
}
