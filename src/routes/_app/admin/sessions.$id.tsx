import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { adminSessionDetailQueryOptions, courtsQueryOptions } from "@/features/admin/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { LockSessionForm } from "@/features/admin/lock-session-form";
import { DeleteSessionButton } from "@/features/admin/delete-session-button";
import { ShareButton } from "@/features/admin/share-button";
import { AddPlayerForm } from "@/features/admin/add-player-form";
import { EditSessionToggle } from "@/features/admin/edit-session-toggle";

export const Route = createFileRoute("/_app/admin/sessions/$id")({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const [data] = await Promise.all([
      queryClient.ensureQueryData(adminSessionDetailQueryOptions(id)),
      queryClient.ensureQueryData(courtsQueryOptions()),
    ]);
    if (!data) throw notFound();
  },
  component: AdminSessionDetailPage,
});

function AdminSessionDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQueryDeferred(adminSessionDetailQueryOptions(id));
  const { gameSession, availablePlayers } = data;

  const yesAttendees = gameSession.attendances.filter((a) => a.status === "YES");
  const isLocked = gameSession.status === "LOCKED";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Session Details</h1>
        <div className="flex items-center gap-2">
          <Badge variant={isLocked ? "default" : "secondary"}>{gameSession.status}</Badge>
          <ShareButton sessionId={id} />
          {!isLocked && (
            <EditSessionToggle
              sessionId={id}
              defaultValues={{
                startTime: gameSession.startTime.toISOString(),
                endTime: gameSession.endTime.toISOString(),
                courts: gameSession.courts,
                costPerCourt: parseFloat(gameSession.costPerCourt),
                location: gameSession.location,
                locationMapUrl: gameSession.locationMapUrl,
                courtNumbers: gameSession.courtNumbers,
                maxPlayers: gameSession.maxPlayers,
                minBalance: parseFloat(gameSession.minBalance),
                note: gameSession.note,
                rsvpDeadline: gameSession.rsvpDeadline?.toISOString() ?? null,
              }}
            />
          )}
          <DeleteSessionButton sessionId={id} isLocked={isLocked} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <p className="text-muted-foreground">Date &amp; Time</p>
              <p className="font-medium">{formatDateTime(gameSession.startTime)}</p>
            </div>
            {gameSession.location && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Venue</p>
                <p className="font-medium">{gameSession.location}</p>
              </div>
            )}
            {gameSession.courtNumbers && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Courts</p>
                <p className="font-medium">{gameSession.courtNumbers}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">No. of Courts</p>
              <p className="font-medium">{gameSession.courts}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost/Court</p>
              <p className="font-medium">{formatCurrency(gameSession.costPerCourt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Confirmed Players</p>
              <p className="font-medium">{yesAttendees.length}</p>
            </div>
            {isLocked && parseFloat(gameSession.shuttleCost) > 0 && (
              <div>
                <p className="text-muted-foreground">Shuttle Cost</p>
                <p className="font-medium">{formatCurrency(gameSession.shuttleCost)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!isLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Walk-in Player</CardTitle>
          </CardHeader>
          <CardContent>
            <AddPlayerForm
              sessionId={id}
              availablePlayers={availablePlayers.map((u) => ({
                id: u.id,
                name: u.name,
                balance: u.balance,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {!isLocked && yesAttendees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lock Session &amp; Deduct Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <LockSessionForm
              sessionId={id}
              courts={gameSession.courts}
              costPerCourt={parseFloat(gameSession.costPerCourt)}
              playerCount={yesAttendees.length}
            />
          </CardContent>
        </Card>
      )}

      {isLocked && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-green-800 font-medium">Session Locked</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(gameSession.costPerPlayer || "0")}/person
              </p>
              <p className="text-sm text-green-700">
                Total: {formatCurrency(gameSession.totalCost || "0")} • {yesAttendees.length}{" "}
                players
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attendees ({yesAttendees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {yesAttendees.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No confirmed attendees</p>
          ) : (
            <div className="space-y-2">
              {yesAttendees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={a.user.image || undefined} />
                      <AvatarFallback>{a.user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{a.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {formatCurrency(a.user.balance)}
                      </p>
                    </div>
                  </div>
                  {a.finalCost && (
                    <span className="text-red-600 font-medium">-{formatCurrency(a.finalCost)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
