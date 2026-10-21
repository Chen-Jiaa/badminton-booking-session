import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { adminSessionsQueryOptions } from "@/features/admin/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SessionList } from "@/features/admin/session-list";

export const Route = createFileRoute("/_console/admin/sessions")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(adminSessionsQueryOptions()),
  component: AdminSessionsPage,
});

function AdminSessionsPage() {
  const { data: allSessions } = useSuspenseQueryDeferred(adminSessionsQueryOptions());
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  // Past = finalized, or already over (even if not finalized yet)
  const now = Date.now();
  const isPast = (s: (typeof allSessions)[number]) =>
    s.status === "LOCKED" || new Date(s.endTime).getTime() < now;
  // Query returns newest first: upcoming reads soonest-first, past stays newest-first
  const upcoming = allSessions.filter((s) => !isPast(s)).reverse();
  const past = allSessions.filter(isPast);
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Sessions</h1>
          <p className="text-sm text-muted-foreground">{allSessions.length} total</p>
        </div>
        <Link to="/admin/sessions/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-72">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {tab} sessions
          </CardContent>
        </Card>
      ) : (
        <SessionList sessions={shown} />
      )}
    </div>
  );
}
