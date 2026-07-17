import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { sessionsQueryOptions } from "@/features/sessions/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/session-card";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/sessions")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(sessionsQueryOptions()),
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQueryDeferred(sessionsQueryOptions());
  const { upcoming, past } = data;
  const userId = user?.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        {(user?.role === "HOST" || user?.role === "ADMIN") && (
          <Link to="/sessions/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Session
            </Button>
          </Link>
        )}
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="flex-1">
            Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {upcoming.map((s) => {
                const myRsvp = userId ? s.attendances.find((a) => a.userId === userId) : null;
                return <SessionCard key={s.id} session={s} userRsvp={myRsvp} userId={userId} />;
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {past.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No past sessions
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {past.map((s) => {
                const myRsvp = userId ? s.attendances.find((a) => a.userId === userId) : null;
                const canManage =
                  user?.role === "ADMIN" || (user?.role === "HOST" && s.createdById === user.id);
                return (
                  <Card key={s.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{formatDateTime(s.startTime)}</p>
                          <p className="text-sm text-muted-foreground">
                            {s.courts} court{s.courts > 1 ? "s" : ""} •{" "}
                            {formatCurrency(s.costPerPlayer || "0")}/person
                          </p>
                        </div>
                        <div className="text-right">
                          {myRsvp?.finalCost && (
                            <p className="font-semibold text-red-600">
                              -{formatCurrency(myRsvp.finalCost)}
                            </p>
                          )}
                          {canManage && (
                            <Link to="/sessions/$id" params={{ id: s.id }}>
                              <Button size="sm" variant="outline" className="mt-2">
                                {s.status === "LOCKED" ? "View" : "Finalize"}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
