import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { sessionDetailQueryOptions } from "@/features/sessions/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Lock } from "lucide-react";
import { RsvpButtons } from "@/features/sessions/rsvp-buttons";

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

export const Route = createFileRoute("/_app/sessions/$id")({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const data = await queryClient.ensureQueryData(sessionDetailQueryOptions(id));
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
  const pastDeadline = gameSession.rsvpDeadline ? now >= gameSession.rsvpDeadline : false;
  const isFull = yesAttendees.length >= gameSession.maxPlayers;
  const isPrivate = parseFloat(gameSession.minBalance) > 0;

  const mapQuery = gameSession.location ? encodeURIComponent(gameSession.location) : null;

  return (
    <div className="-mx-4 -mt-6">
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
          <h1 className="text-lg font-bold uppercase tracking-wide">Badminton</h1>
          <p className="font-semibold">{groupName}</p>
          <p className="text-sm text-muted-foreground">Hosted by {gameSession.createdBy.name}</p>
        </div>

        {/* Location */}
        {gameSession.location && (
          <div className="py-4 border-b space-y-2">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Location</p>
            <p className="font-bold">{gameSession.location}</p>
            <a
              href={
                gameSession.locationMapUrl ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gameSession.location)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-blue-300 text-blue-600 rounded px-3 py-1 text-sm"
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

        {/* Date & Time */}
        <div className="py-4 border-b space-y-1">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
            Date &amp; Time
          </p>
          <p className="font-bold">{formatSessionDate(gameSession.startTime)}</p>
          <p className="text-muted-foreground text-sm">
            {formatTime(gameSession.startTime)} - {formatTime(gameSession.endTime)}
          </p>
        </div>

        {/* Description */}
        {gameSession.note && (
          <div className="py-4 border-b space-y-1">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              Description of Game
            </p>
            <p className="text-sm">{gameSession.note}</p>
          </div>
        )}

        {/* Details */}
        <div className="py-4 border-b space-y-3">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">
            Details of Game
          </p>
          <div className="space-y-2">
            {gameSession.courtNumbers && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-sm">Booked: {gameSession.courtNumbers}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className={`text-sm font-semibold ${isFull ? "text-red-500" : ""}`}>
                  {yesAttendees.length}/{gameSession.maxPlayers} joined
                </span>
                {isFull && <p className="text-xs text-muted-foreground">Sorry, game is full</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Player Grid */}
        {yesAttendees.length > 0 && (
          <div className="py-4 border-b">
            <div className="grid grid-cols-6 gap-x-2 gap-y-4">
              {yesAttendees.map((a) => (
                <div key={a.id} className="flex flex-col items-center gap-1">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={a.user.image || undefined} />
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
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

        {/* Private Game */}
        {isPrivate && (
          <div className="py-4 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <span>Private Game</span>
          </div>
        )}
      </div>

      {/* Sticky RSVP Button */}
      {!isLocked && !hasStarted && !pastDeadline && (
        <div className="fixed bottom-16 left-0 right-0 z-10 border-t bg-white px-4 py-3">
          <RsvpButtons
            sessionId={id}
            currentStatus={myAttendance?.status}
            isLoggedIn={!!userId}
            isFull={isFull && myAttendance?.status !== "YES"}
          />
        </div>
      )}

      {isLocked && (
        <div className="fixed bottom-16 left-0 right-0 z-10 border-t bg-white px-4 py-3">
          <div className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-gray-100 text-muted-foreground text-sm font-medium">
            <Lock className="h-4 w-4" />
            Game Locked
          </div>
        </div>
      )}

      {!isLocked && !hasStarted && pastDeadline && (
        <div className="fixed bottom-16 left-0 right-0 z-10 border-t bg-white px-4 py-3">
          <div className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-gray-100 text-muted-foreground text-sm font-medium">
            RSVP Deadline Passed
          </div>
        </div>
      )}
    </div>
  );
}
