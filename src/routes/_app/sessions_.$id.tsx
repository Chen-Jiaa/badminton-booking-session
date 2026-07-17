import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { sessionDetailQueryOptions } from "@/features/sessions/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, ChevronLeft } from "lucide-react";
import { RsvpButtons } from "@/features/sessions/rsvp-buttons";
import { formatCurrency } from "@/lib/utils";
import { courtsQueryOptions } from "@/features/admin/server";
import { EditSessionToggle } from "@/features/admin/edit-session-toggle";
import { LockSessionForm } from "@/features/admin/lock-session-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatSessionDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleDateString("en", { month: "short" });
  const year = date.getFullYear();
  const weekday = date.toLocaleDateString("en", { weekday: "long" });
  return `${day} ${month} ${year}, ${weekday}`;
}

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toUpperCase();
}

export const Route = createFileRoute("/_app/sessions_/$id")({
  loader: async ({ context: { queryClient, user }, params: { id } }) => {
    const detailPromise = queryClient.ensureQueryData(sessionDetailQueryOptions(id));
    const data =
      user?.role === "HOST" || user?.role === "ADMIN"
        ? (await Promise.all([detailPromise, queryClient.ensureQueryData(courtsQueryOptions())]))[0]
        : await detailPromise;
    if (!data) throw notFound();
  },
  component: SessionDetailPage,
});

function SessionDetailPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQueryDeferred(sessionDetailQueryOptions(id));
  const { gameSession, groupName } = data;

  const userId = user?.id;
  const myAttendance = userId ? gameSession.attendances.find((a) => a.userId === userId) : null;

  const yesAttendees = gameSession.attendances.filter((a) => a.status === "YES");
  const now = new Date();
  const isLocked = gameSession.status === "LOCKED";
  const hasStarted = now >= gameSession.startTime;
  const hasEnded = now >= gameSession.endTime;
  const pastDeadline = gameSession.rsvpDeadline ? now >= gameSession.rsvpDeadline : false;
  const isFull = yesAttendees.length >= gameSession.maxPlayers;
  const canManage =
    user?.role === "ADMIN" || (user?.role === "HOST" && gameSession.createdById === user.id);

  const mapQuery = gameSession.location ? encodeURIComponent(gameSession.location) : null;

  return (
    <div className="-mx-4 -mt-6">
      {/* Back link */}
      <div className="px-4 pt-4 pb-2">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Map */}
      {mapQuery && (
        <div className="h-64 w-full overflow-hidden">
          <iframe
            src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-36">
        {/* Header */}
        <div className="py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold uppercase tracking-wide">Badminton</h1>
            {canManage && !isLocked && (
              <EditSessionToggle
                sessionId={id}
                canManageCourts={user?.role === "ADMIN"}
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
          </div>
          <p className="font-semibold">{groupName}</p>
          <p className="text-sm text-muted-foreground">Hosted by {gameSession.createdBy.name}</p>
        </div>

        {/* Details */}
        <div className="py-4 border-b space-y-3">
          <p className="text-xs font-bold text-brand-foreground uppercase tracking-widest">
            Details of Game
          </p>
          <div className="space-y-2">
            <div>
              <p className="font-bold">{formatSessionDate(gameSession.startTime)}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(gameSession.startTime)} - {formatTime(gameSession.endTime)}
              </p>
              {gameSession.courtNumbers && (
                <p className="text-sm text-muted-foreground">Court: {gameSession.courtNumbers}</p>
              )}
            </div>
            {parseFloat(gameSession.minBalance) > 0 && (
              <p className="text-sm">
                <span className="font-semibold">{formatCurrency(gameSession.minBalance)}</span>{" "}
                deposit to join
                <span className="text-muted-foreground text-xs ml-1">
                  · offset against final cost
                </span>
              </p>
            )}
            {isLocked && (
              <div className="text-sm space-y-1 pt-1">
                <p>
                  <span className="font-semibold">Shuttles used:</span> {gameSession.shuttleCount}
                </p>
                <p>
                  <span className="font-semibold">Shuttle cost:</span>{" "}
                  {formatCurrency(gameSession.shuttleCost)}
                </p>
                <p>
                  <span className="font-semibold">Final cost:</span>{" "}
                  {formatCurrency(gameSession.costPerPlayer || "0")}/person
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {gameSession.location && (
          <div className="py-4 border-b space-y-2">
            <p className="text-xs font-bold text-brand-foreground uppercase tracking-widest">
              Location
            </p>
            <p className="font-bold">{gameSession.location}</p>
            <a
              href={
                gameSession.locationMapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gameSession.location)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-brand text-brand-foreground rounded px-3 py-1 text-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Getting there
            </a>
          </div>
        )}

        {/* Description */}
        {gameSession.note && (
          <div className="py-4 border-b space-y-1">
            <p className="text-xs font-bold text-brand-foreground uppercase tracking-widest">
              Description of Game
            </p>
            <p className="text-sm">{gameSession.note}</p>
          </div>
        )}

        {/* Player Grid */}
        {yesAttendees.length > 0 && (
          <div className="py-4 space-y-3">
            <p className="text-xs font-bold text-brand-foreground uppercase tracking-widest">
              Attendees · {yesAttendees.length}/{gameSession.maxPlayers} joined
            </p>
            <div className="grid grid-cols-6 gap-x-2 gap-y-4">
              {yesAttendees.map((a) => (
                <div key={a.id} className="flex flex-col items-center gap-1">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={a.user.image || undefined} />
                    <AvatarFallback className="text-xs bg-brand text-brand-foreground">
                      {a.user.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-[10px] text-center leading-tight line-clamp-2 w-full">
                    {a.user.name}
                  </p>
                  {a.userId === gameSession.createdById && (
                    <p className="text-[10px] text-muted-foreground">Host</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canManage && !isLocked && hasEnded && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Finalize Session</CardTitle>
            </CardHeader>
            <CardContent>
              {yesAttendees.length > 0 ? (
                <LockSessionForm
                  sessionId={id}
                  courts={gameSession.courts}
                  costPerCourt={parseFloat(gameSession.costPerCourt)}
                  playerCount={yesAttendees.length}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  At least one confirmed player is required before finalizing.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky RSVP Button */}
      {!isLocked && !hasStarted && !pastDeadline && (
        <div className="fixed bottom-20 left-0 right-0 z-10 pointer-events-none">
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <RsvpButtons
              sessionId={id}
              currentStatus={myAttendance?.status}
              isLoggedIn={!!userId}
              isFull={isFull && myAttendance?.status !== "YES"}
            />
          </div>
        </div>
      )}

      {isLocked && (
        <div className="fixed bottom-20 left-0 right-0 z-10 pointer-events-none">
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <div className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-brand text-brand-foreground text-sm font-medium">
              <Lock className="h-4 w-4" />
              Game Locked
            </div>
          </div>
        </div>
      )}

      {!isLocked && !hasStarted && pastDeadline && (
        <div className="fixed bottom-20 left-0 right-0 z-10 pointer-events-none">
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <div className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-brand text-brand-foreground text-sm font-medium">
              RSVP Deadline Passed
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
