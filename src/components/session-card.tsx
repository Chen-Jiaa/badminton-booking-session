import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin } from "lucide-react";

type SessionCardProps = {
  session: {
    id: string;
    startTime: Date;
    endTime: Date;
    courts: number;
    courtNumbers: string | null;
    location: string | null;
    maxPlayers: number;
    rsvpDeadline: Date | null;
    status: string;
    attendances: { status: string; userId: string }[];
    createdBy: { name: string; image: string | null };
  };
  userRsvp?: { status: string } | null;
  userId?: string | null;
};

function formatCardDate(date: Date): string {
  const weekday = date.toLocaleDateString("en", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en", { month: "short" });
  return `${weekday}, ${day} ${month}`;
}

function formatCardTime(date: Date): string {
  return date
    .toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toUpperCase();
}

export function SessionCard({ session, userRsvp }: SessionCardProps) {
  const now = new Date();
  const yesCount = session.attendances.filter((a) => a.status === "YES").length;
  const slotsLeft = session.maxPlayers - yesCount;
  const isFull = slotsLeft <= 0;
  const isJoined = userRsvp?.status === "YES";
  const isLocked = session.status === "LOCKED";
  const pastDeadline = session.rsvpDeadline ? now >= session.rsvpDeadline : false;
  const buttonDisabled = isFull || pastDeadline;

  const courtLabel = session.courtNumbers
    ? `Court ${session.courtNumbers}`
    : `${session.courts} court${session.courts > 1 ? "s" : ""}`;

  const hostInitials = session.createdBy.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link to="/sessions/$id" params={{ id: session.id }}>
      <Card className="hover:shadow-md transition-shadow bg-white border border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-3">
          {/* Date & time */}
          <div>
            <p className="font-bold text-lg">{formatCardDate(session.startTime)}</p>
            <p className="text-sm text-muted-foreground">
              {formatCardTime(session.startTime)} – {formatCardTime(session.endTime)}
              <span className="mx-2">·</span>
              {courtLabel}
            </p>
          </div>

          {/* Host */}
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={session.createdBy.image || undefined} />
              <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                {hostInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{session.createdBy.name}</span>
          </div>

          {/* Location */}
          {session.location && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{session.location}</span>
            </div>
          )}

          {/* Join button */}
          {!isLocked && (
            <button
              className={`w-full py-3 rounded-full text-sm font-semibold transition-colors ${
                isJoined
                  ? "bg-gray-200 text-gray-500"
                  : buttonDisabled
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
              }`}
              tabIndex={-1}
            >
              {isJoined ? "Joined ✓" : "Join Game"}
            </button>
          )}

          {/* Slots left */}
          <p
            className={`text-center text-sm font-semibold opacity-80 ${
              isFull ? "text-red-500" : "text-gray-700"
            }`}
          >
            {isFull
              ? `${yesCount}/${session.maxPlayers} · Full`
              : `${slotsLeft}/${session.maxPlayers} left`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
