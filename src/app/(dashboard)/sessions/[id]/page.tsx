import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { RsvpButtons } from "./rsvp-buttons";

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const userId = session?.user?.id;

  const gameSession = await db.query.sessions.findFirst({
    where: eq(sessions.id, params.id),
    with: {
      attendances: {
        with: { user: true },
      },
    },
  });

  if (!gameSession) {
    notFound();
  }

  const myAttendance = userId
    ? gameSession.attendances.find((a) => a.userId === userId)
    : null;

  const yesAttendees = gameSession.attendances.filter((a) => a.status === "YES");
  const noAttendees = gameSession.attendances.filter((a) => a.status === "NO");
  const waitlistAttendees = gameSession.attendances.filter((a) => a.status === "WAITLIST");

  const isLocked = gameSession.status === "LOCKED";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{formatDateTime(gameSession.startTime)}</CardTitle>
            <Badge variant={isLocked ? "default" : "secondary"}>
              {gameSession.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Courts</p>
              <p className="font-medium">{gameSession.courts}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost/Court</p>
              <p className="font-medium">{formatCurrency(gameSession.costPerCourt)}</p>
            </div>
            {gameSession.shuttleTubes > 0 && (
              <>
                <div>
                  <p className="text-muted-foreground">Shuttle Tubes</p>
                  <p className="font-medium">{gameSession.shuttleTubes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost/Tube</p>
                  <p className="font-medium">{formatCurrency(gameSession.costPerTube)}</p>
                </div>
              </>
            )}
            {gameSession.totalCost && (
              <>
                <div>
                  <p className="text-muted-foreground">Total Cost</p>
                  <p className="font-medium">{formatCurrency(gameSession.totalCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost/Person</p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(gameSession.costPerPlayer || "0")}
                  </p>
                </div>
              </>
            )}
          </div>

          {gameSession.note && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{gameSession.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your RSVP</CardTitle>
          </CardHeader>
          <CardContent>
            <RsvpButtons
              sessionId={params.id}
              currentStatus={myAttendance?.status}
              isLoggedIn={!!userId}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <span className="text-green-600">●</span>
            Going ({yesAttendees.length})
          </h3>
          {yesAttendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {yesAttendees.map((a) => (
                <div key={a.id} className="flex items-center gap-2 bg-green-50 rounded-full px-3 py-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={a.user.image || undefined} />
                    <AvatarFallback className="text-xs">{a.user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{a.user.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {waitlistAttendees.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-yellow-600">●</span>
              Waitlist ({waitlistAttendees.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {waitlistAttendees.map((a) => (
                <div key={a.id} className="flex items-center gap-2 bg-yellow-50 rounded-full px-3 py-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={a.user.image || undefined} />
                    <AvatarFallback className="text-xs">{a.user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{a.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {noAttendees.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span className="text-red-600">●</span>
              Not Going ({noAttendees.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {noAttendees.map((a) => (
                <div key={a.id} className="flex items-center gap-2 bg-red-50 rounded-full px-3 py-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={a.user.image || undefined} />
                    <AvatarFallback className="text-xs">{a.user.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{a.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
