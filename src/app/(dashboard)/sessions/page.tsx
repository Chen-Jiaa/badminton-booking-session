import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, gte, desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { SessionCard } from "@/components/session-card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SessionsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  let isAdmin = false;
  if (userId) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    isAdmin = dbUser?.role === "HOST";
  }

  const now = new Date();

  const upcomingSessions = await db.query.sessions.findMany({
    where: gte(sessions.startTime, now),
    orderBy: [sessions.startTime],
    with: { attendances: true, createdBy: true },
  });

  const pastSessions = await db.query.sessions.findMany({
    where: eq(sessions.status, "LOCKED"),
    orderBy: [desc(sessions.startTime)],
    limit: 20,
    with: { attendances: true, createdBy: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        {isAdmin && (
          <Link href="/admin/sessions/new">
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
          {upcomingSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((s) => {
                const myRsvp = userId ? s.attendances.find((a) => a.userId === userId) : null;
                return <SessionCard key={s.id} session={s} userRsvp={myRsvp} userId={userId} />;
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastSessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No past sessions
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pastSessions.map((s) => {
                const myRsvp = userId ? s.attendances.find((a) => a.userId === userId) : null;
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
