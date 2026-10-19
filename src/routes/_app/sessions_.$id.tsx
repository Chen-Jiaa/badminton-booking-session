import { createFileRoute, notFound, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { useArrivals } from "@/hooks/use-arrivals";
import { sessionDetailQueryOptions } from "@/features/sessions/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, ChevronLeft, MessageCircle } from "lucide-react";
import { whatsAppLink } from "@/lib/phone";
import { RsvpButtons } from "@/features/sessions/rsvp-buttons";
import { cn, formatCurrency, CLUB_TIME_ZONE } from "@/lib/utils";
import { courtsQueryOptions } from "@/features/admin/server";
import { EditSessionToggle } from "@/features/admin/edit-session-toggle";
import { SessionActionsMenu } from "@/features/admin/session-actions-menu";
import { LockSessionForm } from "@/features/admin/lock-session-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionMatches } from "@/features/matches/session-matches";
import { sessionMatchesQueryOptions } from "@/features/matches/server";
import { RECORDING_GRACE_MS } from "@/features/matches/logic";
import {
  AddWalkInButton,
  LateCancelRequests,
  RemovePlayerDialog,
  WaitlistPanel,
} from "@/features/sessions/roster-manage";
import { isLateCancel, waitlistOrder } from "@/features/sessions/rules";

function formatSessionDate(date: Date): string {
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("en", { timeZone: CLUB_TIME_ZONE, ...options });
  return `${part({ day: "numeric" })} ${part({ month: "short" })} ${part({ year: "numeric" })}, ${part({ weekday: "long" })}`;
}

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString("en", {
      timeZone: CLUB_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "")
    .toUpperCase();
}

export const Route = createFileRoute("/_app/sessions_/$id")({
  // Shared links often pick up junk from chat apps (a trailing "." or ")", an invisible
  // zero-width space). Session ids are cuid2 (lowercase alphanumeric), so keep only the
  // leading id and redirect to the clean URL instead of showing "Page not found".
  beforeLoad: ({ params: { id } }) => {
    const cleanId = id.match(/^[a-z0-9]+/i)?.[0]?.toLowerCase();
    if (cleanId && cleanId !== id) {
      throw redirect({ to: "/sessions/$id", params: { id: cleanId }, replace: true });
    }
  },
  loader: async ({ context: { queryClient, user }, params: { id } }) => {
    const detailPromise = queryClient.ensureQueryData(sessionDetailQueryOptions(id));
    queryClient.prefetchQuery(sessionMatchesQueryOptions(id));
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
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const userId = user?.id;
  const myAttendance = userId ? gameSession.attendances.find((a) => a.userId === userId) : null;

  const yesAttendees = gameSession.attendances.filter((a) => a.status === "YES");
  // Someone who joins while you're looking lands in the grid like a court slot filling
  const arrivedIds = useArrivals(yesAttendees.map((a) => a.userId));
  const now = new Date();
  const isLocked = gameSession.status === "LOCKED";
  const hasStarted = now >= gameSession.startTime;
  const hasEnded = now >= gameSession.endTime;
  const pastDeadline = gameSession.rsvpDeadline ? now >= gameSession.rsvpDeadline : false;
  const isFull = yesAttendees.length >= gameSession.maxPlayers;
  const canManage =
    user?.role === "ADMIN" || (user?.role === "HOST" && gameSession.createdById === user.id);
  const isHostOrAdmin = user?.role === "HOST" || user?.role === "ADMIN";
  const host = gameSession.createdBy;
  const hostWhatsApp = host.phone && host.id !== userId ? whatsAppLink(host.phone) : null;
  const waitlist = waitlistOrder(gameSession.attendances);
  const myWaitlistPosition = waitlist.findIndex((a) => a.userId === userId) + 1;
  const rsvpOpen = !hasStarted && !pastDeadline;
  // On court, recording a match is the job, so it takes over the bottom button
  // (unless you've asked out and are waiting to hear back)
  const onCourt =
    hasStarted &&
    !isLocked &&
    now.getTime() <= gameSession.endTime.getTime() + RECORDING_GRACE_MS &&
    myAttendance?.status === "YES" &&
    myAttendance.lateCancelStatus !== "PENDING";
  // Once RSVPs close you can still ask out of the game or leave the waitlist
  const showRsvp =
    !isLocked &&
    !hasEnded &&
    !onCourt &&
    (rsvpOpen || myAttendance?.status === "YES" || myAttendance?.status === "WAITLIST");
  const rosterProps = {
    sessionId: id,
    maxPlayers: gameSession.maxPlayers,
    deposit: parseFloat(gameSession.minBalance),
    attendances: gameSession.attendances,
  };

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
            <div className="flex shrink-0 items-center gap-2">
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
              {isHostOrAdmin && (
                <SessionActionsMenu
                  sessionId={id}
                  isLocked={isLocked}
                  duplicateTo="/sessions/new"
                />
              )}
            </div>
          </div>
          <p className="font-semibold">{groupName}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Hosted by {gameSession.createdBy.name}</p>
            {hostWhatsApp && (
              <a
                href={hostWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-brand px-2 py-0.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {canManage && !isLocked && (
          <div className="pt-4">
            <LateCancelRequests {...rosterProps} />
          </div>
        )}

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
            <p className="text-sm font-semibold">Location</p>
            <p className="font-bold">{gameSession.location}</p>
            <a
              href={
                gameSession.locationMapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gameSession.location)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-brand text-brand-foreground rounded-md px-3 py-1.5 text-sm hover:bg-brand/20 transition-colors"
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
            <p className="text-sm font-semibold">Description</p>
            <p className="text-sm">{gameSession.note}</p>
          </div>
        )}

        {/* Player Grid */}
        {(yesAttendees.length > 0 || (canManage && !isLocked)) && (
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Attendees
                <span className="font-normal text-muted-foreground ml-1">
                  · {yesAttendees.length}/{gameSession.maxPlayers}
                </span>
              </p>
              {canManage && !isLocked && (
                <AddWalkInButton sessionId={id} attendances={gameSession.attendances} />
              )}
            </div>
            <div className="grid grid-cols-5 gap-x-3 gap-y-4">
              {yesAttendees.map((a) => {
                const body = (
                  <>
                    <Avatar className={cn("h-12 w-12", arrivedIds.has(a.userId) && "slot-fill")}>
                      <AvatarImage src={a.user.image || undefined} />
                      <AvatarFallback className="text-xs bg-brand text-brand-foreground">
                        {a.user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-[11px] text-center leading-tight line-clamp-2 w-full">
                      {a.user.name}
                    </p>
                    {a.userId === gameSession.createdById && (
                      <p className="text-[11px] text-muted-foreground">Host</p>
                    )}
                    {canManage && a.lateCancelStatus === "PENDING" && (
                      <p className="text-[11px] font-medium text-warning">Wants out</p>
                    )}
                  </>
                );
                return canManage && !isLocked ? (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={`Remove ${a.user.name}`}
                    onClick={() => setRemoving({ id: a.userId, name: a.user.name })}
                    className="flex flex-col items-center gap-1 rounded-lg transition-[scale] duration-150 active:scale-[0.94]"
                  >
                    {body}
                  </button>
                ) : (
                  <div key={a.id} className="flex flex-col items-center gap-1">
                    {body}
                  </div>
                );
              })}
            </div>
            {canManage && !isLocked && yesAttendees.length > 0 && (
              <p className="text-xs text-muted-foreground">Tap a player to remove them.</p>
            )}
            {canManage && (
              <RemovePlayerDialog
                sessionId={id}
                player={removing}
                onClose={() => setRemoving(null)}
              />
            )}
          </div>
        )}

        {/* Waitlist */}
        {canManage && !isLocked ? (
          <div className="py-4 border-t">
            <WaitlistPanel {...rosterProps} plain />
          </div>
        ) : (
          waitlist.length > 0 &&
          !isLocked && (
            <div className="py-4 space-y-3 border-t">
              <p className="text-sm font-semibold">
                Waitlist
                <span className="font-normal text-muted-foreground ml-1">
                  · {waitlist.length} waiting
                </span>
              </p>
              <ol className="space-y-2">
                {waitlist.map((a, i) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={a.user.image || undefined} />
                      <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                        {a.user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className={cn("text-sm", a.userId === userId && "font-semibold")}>
                      {a.user.name}
                      {a.userId === userId && " (you)"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )
        )}

        <SessionMatches
          sessionId={id}
          startTime={gameSession.startTime}
          endTime={gameSession.endTime}
          me={myAttendance?.status === "YES" ? myAttendance.user : null}
          attendees={yesAttendees.map((a) => a.user)}
          stickyRecord={onCourt}
        />

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
      {showRsvp && (
        <div
          className="fixed left-0 right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <RsvpButtons
              sessionId={id}
              currentStatus={myAttendance?.status}
              lateCancelStatus={myAttendance?.lateCancelStatus}
              waitlistPosition={myWaitlistPosition || undefined}
              isLateCancel={isLateCancel(gameSession.startTime, now)}
              isLoggedIn={!!userId}
              isFull={isFull && myAttendance?.status !== "YES"}
              deposit={parseFloat(gameSession.minBalance)}
            />
          </div>
        </div>
      )}

      {isLocked && (
        <div
          className="fixed left-0 right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <div className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-brand text-brand-foreground text-sm font-medium">
              <Lock className="h-4 w-4" />
              Game Locked
            </div>
          </div>
        </div>
      )}

      {!showRsvp && !isLocked && !hasStarted && pastDeadline && (
        <div
          className="fixed left-0 right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
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
