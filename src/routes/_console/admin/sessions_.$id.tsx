import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { adminSessionDetailQueryOptions, courtsQueryOptions } from "@/features/admin/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Ellipsis } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { LockSessionForm } from "@/features/admin/lock-session-form";
import { SessionActionsMenu } from "@/features/admin/session-actions-menu";
import { AddPlayerForm } from "@/features/admin/add-player-form";
import { EditSessionToggle } from "@/features/admin/edit-session-toggle";
import {
  LateCancelRequests,
  PlayerActionsDialog,
  WaitlistPanel,
} from "@/features/sessions/roster-manage";

export const Route = createFileRoute("/_console/admin/sessions_/$id")({
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
  const [removing, setRemoving] = useState<{
    id: string;
    name: string;
    phone?: string | null;
  } | null>(null);

  const yesAttendees = gameSession.attendances.filter((a) => a.status === "YES");
  const isLocked = gameSession.status === "LOCKED";
  const hasEnded = new Date() >= gameSession.endTime;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{formatDateTime(gameSession.startTime)}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {gameSession.location && <span>{gameSession.location}</span>}
            <Badge variant={isLocked ? "default" : "secondary"}>{gameSession.status}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <SessionActionsMenu
            sessionId={id}
            isLocked={isLocked}
            duplicateTo="/admin/sessions/new"
            canDelete
          />
        </div>
      </div>

      {!isLocked && (
        <LateCancelRequests
          sessionId={id}
          maxPlayers={gameSession.maxPlayers}
          deposit={parseFloat(gameSession.minBalance)}
          attendances={gameSession.attendances}
        />
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
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
              <p className="font-medium">
                {yesAttendees.length}/{gameSession.maxPlayers}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Waitlist</p>
              <p className="font-medium">
                {gameSession.attendances.filter((a) => a.status === "WAITLIST").length}
              </p>
            </div>
            {isLocked && (
              <div>
                <p className="text-muted-foreground">Shuttles Used</p>
                <p className="font-medium">
                  {gameSession.shuttleCount} ({formatCurrency(gameSession.shuttleCost)})
                </p>
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

      {!isLocked && hasEnded && yesAttendees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Finalize Session &amp; Deduct Costs</CardTitle>
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
        <Card className="bg-brand border-brand">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-brand-foreground font-medium">Session Locked</p>
              <p className="text-2xl font-bold text-brand-foreground">
                {formatCurrency(gameSession.costPerPlayer || "0")}/person
              </p>
              <p className="text-sm text-brand-foreground/70">
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
                      <p className="font-medium">
                        {a.user.name}
                        {a.lateCancelStatus === "PENDING" && (
                          <Badge variant="warning" className="ml-2">
                            Wants out
                          </Badge>
                        )}
                        {a.lateCancelStatus === "REJECTED" && (
                          <Badge variant="outline" className="ml-2">
                            Late cancel declined
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {formatCurrency(a.user.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.finalCost && (
                      <span className="text-danger font-medium">
                        -{formatCurrency(a.finalCost)}
                      </span>
                    )}
                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Manage ${a.user.name}`}
                        className="h-10 w-10 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setRemoving({
                            id: a.user.id,
                            name: a.user.name,
                            phone: a.user.isGuest ? undefined : a.user.phone,
                          })
                        }
                      >
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PlayerActionsDialog sessionId={id} player={removing} onClose={() => setRemoving(null)} />

      {!isLocked && (
        <WaitlistPanel
          sessionId={id}
          maxPlayers={gameSession.maxPlayers}
          deposit={parseFloat(gameSession.minBalance)}
          attendances={gameSession.attendances}
        />
      )}
    </div>
  );
}
