import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { users, sessions, attendances } from "@/db/schema";
import { eq, gte } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionCard } from "@/components/session-card";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    : null;

  const upcomingSessions = await db.query.sessions.findMany({
    where: gte(sessions.startTime, new Date()),
    orderBy: [sessions.startTime],
    limit: 3,
    with: {
      attendances: userId
        ? {
            where: eq(attendances.userId, userId),
          }
        : true,
    },
  });

  const balance = parseFloat(user?.balance || "0");
  const isLowBalance = balance < 20;

  return (
    <div className="space-y-6">
      {user && (
        <Card className={isLowBalance ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className={cn(
                  "text-3xl font-bold",
                  balance < 0 ? "text-red-600" : isLowBalance ? "text-yellow-600" : "text-green-600"
                )}>
                  {formatCurrency(balance)}
                </p>
                {isLowBalance && (
                  <p className="text-sm text-red-600 mt-1">Low balance - please top up</p>
                )}
              </div>
              <Link href="/topup">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Top Up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Upcoming Sessions</h2>
          <Link href="/sessions" className="text-sm text-green-600 flex items-center">
            View all <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
        {upcomingSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No upcoming sessions
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map((s) => {
              const myRsvp = userId
                ? s.attendances.find((a) => a.userId === userId)
                : null;
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  userRsvp={myRsvp}
                  showStatus
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
