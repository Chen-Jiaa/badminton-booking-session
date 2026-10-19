import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { TopUpDialog } from "@/features/topup/topup-dialog";
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
import { MapPin, Loader2, Users, Check } from "lucide-react";
import { CopyIcon } from "@/components/copy-icon";
import { toast } from "sonner";
import { rsvpFn } from "@/features/sessions/server";
import { formatCurrency } from "@/lib/utils";
import { JoinBurst, useJoinCelebration } from "@/features/sessions/join-celebration";
import { isLateCancel } from "@/features/sessions/rules";

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
    costPerPlayer?: string | null;
    rsvpDeadline: Date | null;
    status: string;
    attendances: { status: string; userId: string; finalCost?: string | null }[];
    createdBy: { name: string; image: string | null };
  };
  userRsvp?: { status: string; finalCost?: string | null; lateCancelStatus?: string | null } | null;
  userId?: string | null;
  isPast?: boolean;
  canManage?: boolean;
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

export function SessionCard({
  session,
  userRsvp,
  userId,
  isPast = false,
  canManage = false,
}: SessionCardProps) {
  const now = new Date();
  const yesCount = session.attendances.filter((a) => a.status === "YES").length;
  const slotsLeft = session.maxPlayers - yesCount;
  const isFull = slotsLeft <= 0;
  const waitlistCount = session.attendances.filter((a) => a.status === "WAITLIST").length;
  const isJoined = userRsvp?.status === "YES";
  const isWaitlisted = userRsvp?.status === "WAITLIST";
  const isLocked = session.status === "LOCKED";
  const pastDeadline = session.rsvpDeadline ? now >= session.rsvpDeadline : false;
  const buttonDisabled = pastDeadline && !isWaitlisted;
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
  const [showTopUp, setShowTopUp] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const queryClient = useQueryClient();
  const { celebrating, celebrateJoin } = useJoinCelebration();
  const navigate = useNavigate();

  const currentUser = queryClient.getQueryData<{ balance: string } | null>(["current-user"]);
  const hasInsufficientBalance = !!(
    userId &&
    !isJoined &&
    deposit > 0 &&
    currentUser &&
    parseFloat(currentUser.balance) < deposit
  );

  const shortfall = hasInsufficientBalance
    ? Math.ceil(deposit - parseFloat(currentUser!.balance))
    : 0;

  async function handleRsvp(status: "YES" | "NO", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;

    // Optimistically update the sessions list cache
    type Attendance = { status: string; userId: string };
    type SessionEntry = { id: string; attendances: Attendance[] };
    type SessionsCache = { upcoming: SessionEntry[]; past: SessionEntry[] };
    const prevData = queryClient.getQueryData<SessionsCache>(["sessions"]);
    if (prevData) {
      const toggle = (list: SessionEntry[]) =>
        list.map((s) =>
          s.id !== session.id
            ? s
            : {
                ...s,
                attendances:
                  status === "YES"
                    ? [
                        ...s.attendances.filter((a) => a.userId !== userId),
                        { userId, status: "YES" },
                      ]
                    : s.attendances.map((a) => (a.userId === userId ? { ...a, status: "NO" } : a)),
              },
        );
      queryClient.setQueryData<SessionsCache>(["sessions"], {
        upcoming: toggle(prevData.upcoming),
        past: toggle(prevData.past),
      });
    }

    setLoading(true);
    try {
      const result = await rsvpFn({ data: { sessionId: session.id, status } });
      if (result.type !== "SUCCESS") {
        // Roll back optimistic update on failure
        if (prevData) queryClient.setQueryData(["sessions"], prevData);
        if (result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE") {
          toast.error("Not enough balance", {
            description: `You need ${formatCurrency(session.minBalance)} to join. Top up your wallet first.`,
          });
        } else {
          toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to update RSVP");
        }
        return;
      }
      if (status === "YES") celebrateJoin();
    } catch {
      if (prevData) queryClient.setQueryData(["sessions"], prevData);
      toast.error("Failed to update RSVP");
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
      // Sync truth from server
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    }
  }

  function handleButtonClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // The waitlist and late cancellations have rules to explain, so they live on
    // the session page rather than in a quick tap here
    if (hasInsufficientBalance && !isWaitlisted) {
      setShowTopUp(true);
    } else if (
      isWaitlisted ||
      (isJoined && isLateCancel(session.startTime)) ||
      (!isJoined && isFull)
    ) {
      navigate({ to: "/sessions/$id", params: { id: session.id } });
    } else if (isJoined) {
      setShowLeaveDialog(true);
    } else {
      handleRsvp("YES", e);
    }
  }

  async function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sessions/${session.id}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
    navigate({ to: "/sessions/$id", params: { id: session.id } });
  }

  function handleCardKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if ((e.target as HTMLElement).closest('button, a, [role="button"]')) return;
    navigate({ to: "/sessions/$id", params: { id: session.id } });
  }

  return (
    <>
      <Card
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="link"
        tabIndex={0}
        className={`hover:shadow-md transition-[box-shadow,scale] active:scale-[0.99] bg-white shadow-sm rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${isPast && canManage && !isLocked ? "border-2 border-warning" : "border border-gray-100"}`}
      >
        <CardContent className="p-5">
          {/* Primary: date & time */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-lg leading-tight">{formatCardDate(session.startTime)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatCardTime(session.startTime)} – {formatCardTime(session.endTime)}
                <span className="mx-2">·</span>
                {courtLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              aria-label="Copy link"
              className="relative -mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-[color,background-color,scale] duration-150 hover:bg-gray-100 hover:text-foreground active:scale-90 after:absolute after:-inset-1 after:content-['']"
            >
              <CopyIcon copied={linkCopied} />
            </button>
          </div>

          {/* Secondary metadata: host + location */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={session.createdBy.image || undefined} />
                <AvatarFallback className="text-[11px] bg-brand text-brand-foreground">
                  {hostInitials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{session.createdBy.name}</span>
            </div>
            {session.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{session.location}</span>
              </div>
            )}
          </div>

          {/* Action zone */}
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
            {isPast ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{yesCount} attended</span>
                </div>
                {userRsvp?.finalCost ? (
                  <p className="text-sm font-semibold text-danger text-center">
                    -{formatCurrency(userRsvp.finalCost)}
                  </p>
                ) : session.costPerPlayer ? (
                  <p className="text-sm text-muted-foreground text-center">
                    {formatCurrency(session.costPerPlayer)}/person
                  </p>
                ) : null}
                {canManage && !isLocked && (
                  <div className="w-full py-2.5 rounded-full text-sm font-semibold text-center bg-danger text-white">
                    Needs finalization
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className={`flex items-center gap-2 text-sm ${isFull ? "text-danger" : "text-muted-foreground"}`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>
                    {isFull
                      ? `${yesCount}/${session.maxPlayers} · Full${waitlistCount > 0 ? ` · ${waitlistCount} waiting` : ""}`
                      : `${slotsLeft}/${session.maxPlayers} left`}
                  </span>
                </div>
                {!isLocked && !userId && (
                  <Button
                    variant="brand"
                    size="cta"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowLoginDialog(true);
                    }}
                  >
                    Sign in
                  </Button>
                )}
                {!isLocked && userId && celebrating && (
                  <div className="relative">
                    <JoinBurst />
                    <Button
                      disabled
                      aria-live="polite"
                      size="cta"
                      className="join-pop bg-brand-foreground shadow-sm disabled:pointer-events-auto disabled:opacity-100"
                      style={{ color: "hsl(var(--background))" }}
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                      You&rsquo;re in!
                    </Button>
                  </div>
                )}
                {!isLocked && userId && !celebrating && (
                  <Button
                    variant={isJoined || isWaitlisted ? "joined" : "brand"}
                    size="cta"
                    onClick={handleButtonClick}
                    disabled={loading || (!isJoined && buttonDisabled)}
                    // Keep taps on a disabled button from falling through to the card link
                    className="disabled:pointer-events-auto"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isJoined && userRsvp?.lateCancelStatus === "PENDING" ? (
                      "Joined · cancellation pending"
                    ) : isJoined ? (
                      <>
                        <Check className="h-4 w-4" />
                        Joined
                      </>
                    ) : isWaitlisted ? (
                      "On the waitlist"
                    ) : pastDeadline ? (
                      "RSVP closed"
                    ) : hasInsufficientBalance ? (
                      `Top up ${formatCurrency(shortfall.toFixed(2))} to join`
                    ) : isFull ? (
                      "Session full · Join waitlist"
                    ) : (
                      "Join Game"
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
      <TopUpDialog open={showTopUp} onOpenChange={setShowTopUp} initialAmount={shortfall} />

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave game?</DialogTitle>
            <DialogDescription>
              {deposit > 0
                ? `Your ${formatCurrency(session.minBalance)} deposit will be refunded to your wallet.`
                : "You won't be able to undo this."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={loading} onClick={(e) => handleRsvp("NO", e)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
