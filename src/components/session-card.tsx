import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LoginDialog } from "@/features/sessions/login-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { rsvpFn } from "@/features/sessions/server";
import { formatCurrency } from "@/lib/utils";

type SessionCardProps = {
  session: {
    id: string;
    startTime: Date;
    endTime: Date;
    courts: number;
    courtNumbers: string | null;
    location: string | null;
    maxPlayers: number;
    minBalance: string;
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

export function SessionCard({ session, userRsvp, userId }: SessionCardProps) {
  const now = new Date();
  const yesCount = session.attendances.filter((a) => a.status === "YES").length;
  const slotsLeft = session.maxPlayers - yesCount;
  const isFull = slotsLeft <= 0;
  const isJoined = userRsvp?.status === "YES";
  const isLocked = session.status === "LOCKED";
  const pastDeadline = session.rsvpDeadline ? now >= session.rsvpDeadline : false;
  const buttonDisabled = (isFull && !isJoined) || pastDeadline;
  const deposit = parseFloat(session.minBalance);

  const courtLabel = session.courtNumbers
    ? `Court ${session.courtNumbers}`
    : `${session.courts} court${session.courts > 1 ? "s" : ""}`;

  const hostInitials = session.createdBy.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const [loading, setLoading] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function handleRsvp(status: "YES" | "NO", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    setLoading(true);
    try {
      const result = await rsvpFn({ data: { sessionId: session.id, status } });
      if (result.type !== "SUCCESS") {
        toast({ title: "Failed to update RSVP", variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      toast({ title: "Failed to update RSVP", variant: "destructive" });
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
    }
  }

  function handleButtonClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isJoined) {
      setShowLeaveDialog(true);
    } else {
      handleRsvp("YES", e);
    }
  }

  return (
    <>
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
              <Avatar className="h-6 w-6">
                <AvatarImage src={session.createdBy.image || undefined} />
                <AvatarFallback className="text-xs bg-brand text-brand-foreground">
                  {hostInitials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{session.createdBy.name} (Host)</span>
            </div>

            {/* Location */}
            {session.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{session.location}</span>
              </div>
            )}
            {/* Slots left */}
            <div className={`flex items-center gap-2 text-sm ${isFull ? "text-red-500" : "text-muted-foreground"}`}>
              <Users className="h-4 w-4 shrink-0" />
              <span>
                {isFull
                  ? `${yesCount}/${session.maxPlayers} · Full`
                  : `${slotsLeft}/${session.maxPlayers} left`}
              </span>
            </div>

            

            {/* Sign in button for unauthenticated users */}
            {!isLocked && !userId && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginDialog(true); }}
                className="w-full py-3 rounded-full text-sm font-semibold transition-colors bg-brand text-brand-foreground hover:bg-brand/80"
              >
                Sign in
              </button>
            )}

            {/* Join/Leave button */}
            {!isLocked && userId && (
              <button
                onClick={handleButtonClick}
                disabled={loading || (!isJoined && buttonDisabled)}
                className={`w-full py-3 rounded-full text-sm font-semibold transition-colors ${
                  isJoined
                    ? "bg-brand text-brand-foreground"
                    : buttonDisabled
                      ? "bg-brand text-brand-foreground cursor-not-allowed opacity-60"
                      : "bg-brand text-brand-foreground hover:bg-brand/80"
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : isJoined ? (
                  "Joined ✓"
                ) : (
                  "Join Game"
                )}
              </button>
            )}

            {/* Deposit notice */}
            {!isLocked && deposit > 0 && !isJoined && (
              <p className="text-xs text-muted-foreground/60 text-center">
                {formatCurrency(session.minBalance)} deposit required to join
              </p>
            )}

            
          </CardContent>
        </Card>
      </Link>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave game?</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this session?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={(e) => handleRsvp("NO", e)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
