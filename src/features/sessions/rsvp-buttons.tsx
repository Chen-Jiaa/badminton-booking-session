import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import { LoginDialog } from "@/features/sessions/login-dialog";
import { rsvpFn, sessionDetailQueryOptions } from "@/features/sessions/server";
import { currentUserQueryOptions } from "@/features/auth/server";
import { formatCurrency } from "@/lib/utils";

/** A single stylized shuttlecock: feather skirt with a cork tip. */
function Shuttlecock() {
  return (
    <svg viewBox="0 0 24 28" width="18" height="21" fill="none" aria-hidden="true">
      <path
        d="M12 20 L6.5 4.5 L17.5 4.5 Z"
        fill="hsl(var(--background))"
        stroke="hsl(var(--brand-foreground))"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <line x1="12" y1="20" x2="9.2" y2="4.7" stroke="hsl(var(--brand-foreground))" strokeWidth="0.8" />
      <line x1="12" y1="20" x2="14.8" y2="4.7" stroke="hsl(var(--brand-foreground))" strokeWidth="0.8" />
      <circle cx="12" cy="21.2" r="3.2" fill="hsl(var(--brand-foreground))" />
    </svg>
  );
}

// Birdies fan upward in an arc from the button center.
const BIRDIES = [
  { tx: "0px", ty: "-116px", rStart: "-6deg", rEnd: "8deg", dur: "980ms" },
  { tx: "-34px", ty: "-98px", rStart: "-18deg", rEnd: "-34deg", dur: "900ms" },
  { tx: "34px", ty: "-98px", rStart: "18deg", rEnd: "34deg", dur: "900ms" },
  { tx: "-70px", ty: "-64px", rStart: "-30deg", rEnd: "-58deg", dur: "820ms" },
  { tx: "70px", ty: "-64px", rStart: "30deg", rEnd: "58deg", dur: "820ms" },
  { tx: "-104px", ty: "-30px", rStart: "-46deg", rEnd: "-78deg", dur: "760ms" },
  { tx: "104px", ty: "-30px", rStart: "46deg", rEnd: "78deg", dur: "760ms" },
];

/** Burst of shuttlecocks fired when a player claims their spot. */
function JoinBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {BIRDIES.map((b, i) => (
        <span
          key={i}
          className="birdie absolute left-0 top-0 block will-change-transform"
          style={
            {
              "--tx": b.tx,
              "--ty": b.ty,
              "--r-start": b.rStart,
              "--r-end": b.rEnd,
              "--dur": b.dur,
            } as CSSProperties
          }
        >
          <Shuttlecock />
        </span>
      ))}
    </div>
  );
}

interface RsvpButtonsProps {
  sessionId: string;
  currentStatus?: "YES" | "NO" | "WAITLIST";
  isLoggedIn: boolean;
  isFull?: boolean;
  deposit?: number;
}

export function RsvpButtons({ sessionId, currentStatus, isLoggedIn, isFull, deposit = 0 }: RsvpButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"YES" | "NO" | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, []);

  function celebrateJoin() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // A little "birdie landing" tap-tap.
      navigator.vibrate?.([12, 28, 16]);
    }
    setCelebrating(true);
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 1500);
  }

  const currentUser = queryClient.getQueryData<{
    id: string;
    balance: string;
    name: string | null;
    image: string | null;
    [key: string]: unknown;
  } | null>(currentUserQueryOptions().queryKey);

  const hasInsufficientBalance =
    !!(isLoggedIn && deposit > 0 && currentUser && parseFloat(currentUser.balance) < deposit);

  async function handleRsvp(status: "YES" | "NO") {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }

    setPendingStatus(status);
    setLoading(true);

    // Snapshot for rollback
    const prevSessionData = queryClient.getQueryData(sessionDetailQueryOptions(sessionId).queryKey);
    const prevUserData = queryClient.getQueryData(currentUserQueryOptions().queryKey);

    // Cancel in-flight refetches so they don't overwrite our optimistic update
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ["sessions", sessionId] }),
      queryClient.cancelQueries({ queryKey: currentUserQueryOptions().queryKey }),
    ]);

    // Optimistically update attendee list
    if (currentUser?.id) {
      queryClient.setQueryData(
        sessionDetailQueryOptions(sessionId).queryKey,
        (old: typeof prevSessionData) => {
          if (!old) return old;
          const now = new Date();
          const existingIdx = old.gameSession.attendances.findIndex(
            (a) => a.userId === currentUser.id,
          );

          let updatedAttendances;
          if (status === "YES") {
            if (existingIdx >= 0) {
              updatedAttendances = old.gameSession.attendances.map((a, i) =>
                i === existingIdx ? { ...a, status: "YES" as const, updatedAt: now } : a,
              );
            } else {
              updatedAttendances = [
                ...old.gameSession.attendances,
                {
                  id: `optimistic-${currentUser.id}`,
                  sessionId,
                  userId: currentUser.id,
                  status: "YES" as const,
                  finalCost: null,
                  createdAt: now,
                  updatedAt: now,
                  user: {
                    id: currentUser.id,
                    name: currentUser.name ?? "",
                    image: currentUser.image ?? null,
                  },
                },
              ];
            }
          } else {
            updatedAttendances = old.gameSession.attendances.map((a) =>
              a.userId === currentUser.id ? { ...a, status: "NO" as const, updatedAt: now } : a,
            );
          }

          return {
            ...old,
            gameSession: { ...old.gameSession, attendances: updatedAttendances },
          };
        },
      );

      // Optimistically update balance
      if (deposit > 0) {
        const balanceDelta = status === "YES" ? -deposit : currentStatus === "YES" ? deposit : 0;
        if (balanceDelta !== 0) {
          queryClient.setQueryData(
            currentUserQueryOptions().queryKey,
            (old: typeof prevUserData) => {
              if (!old) return old;
              return {
                ...old,
                balance: (parseFloat(old.balance) + balanceDelta).toFixed(2),
              };
            },
          );
        }
      }
    }

    function rollback() {
      queryClient.setQueryData(sessionDetailQueryOptions(sessionId).queryKey, prevSessionData);
      queryClient.setQueryData(currentUserQueryOptions().queryKey, prevUserData);
    }

    try {
      const result = await rsvpFn({ data: { sessionId, status } });

      if (result.type === "AUTH_ERROR") {
        setPendingStatus(null);
        rollback();
        toast({ title: "Please sign in to RSVP", variant: "destructive" });
        setShowLogin(true);
        return;
      }

      if (result.type !== "SUCCESS") {
        setPendingStatus(null);
        rollback();
        if (result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE") {
          toast({
            title: "Not enough balance",
            description: deposit > 0
              ? `You need ${formatCurrency(deposit.toFixed(2))} to join. Top up your wallet first.`
              : "Top up your wallet to join this session.",
            variant: "destructive",
          });
        } else {
          toast({
            title: result.type === "BUSINESS_ERROR" ? result.code : "Failed to update RSVP",
            variant: "destructive",
          });
        }
        return;
      }

      // Confirm balance from server response — no refetch needed
      queryClient.setQueryData(
        currentUserQueryOptions().queryKey,
        (old: typeof prevUserData) => old ? { ...old, balance: result.value.newBalance } : old,
      );

      // You're in — mark the moment you claimed a spot on the court.
      if (status === "YES") celebrateJoin();
    } catch {
      setPendingStatus(null);
      rollback();
      toast({ title: "Failed to update RSVP", variant: "destructive" });
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
      // Background sync — no UI blocking
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey });
    }
  }

  const effectiveStatus = pendingStatus ?? currentStatus;
  const isJoined = effectiveStatus === "YES";

  return (
    <div className="relative">
      {celebrating && <JoinBurst />}
      {celebrating ? (
        <Button
          disabled
          aria-live="polite"
          className="join-pop w-full gap-2 bg-brand-foreground font-semibold shadow-sm disabled:opacity-100"
          style={{ color: "hsl(var(--background))" }}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          You&rsquo;re in!
        </Button>
      ) : isJoined ? (
        <Button
          onClick={() => setShowLeaveDialog(true)}
          disabled={loading}
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Game"}
        </Button>
      ) : !isLoggedIn ? (
        <Button
          onClick={() => setShowLogin(true)}
          className="w-full bg-brand text-brand-foreground hover:bg-brand/80"
        >
          Sign in
        </Button>
      ) : (
        <Button
          onClick={() => handleRsvp("YES")}
          disabled={loading || isFull || hasInsufficientBalance}
          className={
            isFull || hasInsufficientBalance
              ? "w-full bg-brand text-brand-foreground cursor-not-allowed opacity-60"
              : "w-full bg-brand text-brand-foreground hover:bg-brand/80"
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Game"}
        </Button>
      )}

      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave game?</DialogTitle>
            <DialogDescription>
              {deposit > 0
                ? `Your ${formatCurrency(deposit.toFixed(2))} deposit will be refunded to your wallet.`
                : "You won't be able to undo this."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => handleRsvp("NO")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
