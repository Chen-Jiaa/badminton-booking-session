import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { sessionsQueryOptions } from "@/features/sessions/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/session-card";
import { PendingMatchesBanner } from "@/features/matches/pending-banner";
import { PhoneNudge } from "@/features/profile/phone-nudge";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/sessions")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(sessionsQueryOptions()),
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQueryDeferred(sessionsQueryOptions());
  const { upcoming, past, live } = data;
  const userId = user?.id;
  const isHostOrAdmin = user?.role === "HOST" || user?.role === "ADMIN";
  const now = new Date();
  const canManageSession = (createdById: string) =>
    user?.role === "ADMIN" || (user?.role === "HOST" && createdById === user.id);
  // Ended and not finalized, that this person has to finalize
  const unfinalizedCount = isHostOrAdmin
    ? [...past, ...live].filter((s) => {
        if (s.status === "LOCKED" || now < s.endTime) return false;
        if (user?.role === "ADMIN") return true;
        return s.createdById === user?.id;
      }).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        {isHostOrAdmin && (
          <Link to="/sessions/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Session
            </Button>
          </Link>
        )}
      </div>

      <PendingMatchesBanner
        sessionId={user?.pendingMatchSessionId}
        count={user?.pendingMatchesCount}
      />

      <PhoneNudge hasPhone={user?.hasPhone} />

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="flex-1">
            <span className="relative inline-flex items-center gap-1.5">
              Past
              {unfinalizedCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white leading-none">
                  {unfinalizedCount}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {live.length > 0 && (
            <section className="mb-6 flex flex-col gap-4" aria-label="Happening now">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Happening now
              </h2>
              {live.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  userId={userId}
                  isLive
                  canManage={canManageSession(s.createdById)}
                />
              ))}
            </section>
          )}
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
                const canManage = canManageSession(s.createdById);
                return (
                  <SessionCard
                    key={s.id}
                    session={s}
                    userRsvp={myRsvp}
                    userId={userId}
                    isPast
                    canManage={canManage}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
