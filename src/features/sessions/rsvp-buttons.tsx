import { useState } from "react";
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
import { toast } from "sonner";
import { Check, Clock, Loader2 } from "lucide-react";
import { TopUpDialog } from "@/features/topup/topup-dialog";
import { LoginDialog } from "@/features/sessions/login-dialog";
import {
  rsvpFn,
  sessionDetailQueryOptions,
  withdrawLateCancelFn,
  type RsvpOutcome,
} from "@/features/sessions/server";
import { currentUserQueryOptions } from "@/features/auth/server";
import { formatCurrency } from "@/lib/utils";
import { JoinBurst, useJoinCelebration } from "@/features/sessions/join-celebration";

interface RsvpButtonsProps {
  sessionId: string;
  currentStatus?: "YES" | "NO" | "WAITLIST";
  lateCancelStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** 1-based place in the waitlist queue */
  waitlistPosition?: number;
  /** Inside the 24h window: leaving needs a host/admin to approve */
  isLateCancel?: boolean;
  isLoggedIn: boolean;
  isFull?: boolean;
  deposit?: number;
}

const OUTCOME_TOASTS: Partial<Record<RsvpOutcome, [string, string?]>> = {
  WAITLISTED: ["You're on the waitlist", "We'll take your deposit and notify you if a spot opens."],
  LEFT_WAITLIST: ["You've left the waitlist"],
  LATE_CANCEL_REQUESTED: [
    "Cancellation requested",
    "A host will review it. You're still on the list until then.",
  ],
};

export function RsvpButtons({
  sessionId,
  currentStatus,
  lateCancelStatus,
  waitlistPosition,
  isLateCancel = false,
  isLoggedIn,
  isFull,
  deposit = 0,
}: RsvpButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"YES" | "NO" | null>(null);
  const { celebrating, celebrateJoin } = useJoinCelebration();
  const queryClient = useQueryClient();

  const currentUser = queryClient.getQueryData<{
    id: string;
    balance: string;
    name: string | null;
    image: string | null;
    [key: string]: unknown;
  } | null>(currentUserQueryOptions().queryKey);

  const hasInsufficientBalance = !!(
    isLoggedIn &&
    deposit > 0 &&
    currentUser &&
    parseFloat(currentUser.balance) < deposit
  );

  // Whole ringgit, since the top-up form takes round amounts
  const shortfall = hasInsufficientBalance
    ? Math.ceil(deposit - parseFloat(currentUser!.balance))
    : 0;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey }),
      queryClient.invalidateQueries({ queryKey: ["wallet"], refetchType: "all" }),
    ]);
  }

  // Waitlist moves and late-cancel requests don't change the roster straight
  // away, so they skip the optimistic path and just refetch
  async function handleQueued(
    action: () => Promise<{ type: string; code?: string; value?: unknown }>,
    success?: [string, string?],
  ) {
    setLoading(true);
    try {
      const result = await action();
      if (result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE") {
        toast.error("Not enough balance", {
          description: `You need ${formatCurrency(deposit.toFixed(2))} on hand to join the waitlist.`,
        });
        return;
      }
      if (result.type !== "SUCCESS") {
        toast.error(result.code ?? "Failed to update RSVP");
        return;
      }
      const outcome = (result.value as { outcome?: RsvpOutcome } | undefined)?.outcome;
      const message = (outcome && OUTCOME_TOASTS[outcome]) || success;
      if (message) toast.success(message[0], { description: message[1] });
    } catch {
      toast.error("Failed to update RSVP");
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
      await refresh();
    }
  }

  async function handleRsvp(status: "YES" | "NO") {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    if (status === "NO" && isLateCancel && currentStatus === "YES") {
      return handleQueued(() => rsvpFn({ data: { sessionId, status: "NO" } }));
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
                    isGuest: false,
                    sponsorId: null,
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
        toast.error("Please sign in to RSVP");
        setShowLogin(true);
        return;
      }

      if (result.type !== "SUCCESS") {
        setPendingStatus(null);
        rollback();
        if (result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE") {
          toast.error("Not enough balance", {
            description:
              deposit > 0
                ? `You need ${formatCurrency(deposit.toFixed(2))} to join. Top up your wallet first.`
                : "Top up your wallet to join this session.",
          });
        } else {
          toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to update RSVP");
        }
        return;
      }

      // Confirm balance from server response — no refetch needed
      queryClient.setQueryData(currentUserQueryOptions().queryKey, (old: typeof prevUserData) =>
        old ? { ...old, balance: result.value.newBalance } : old,
      );
      queryClient.setQueryData<{ balance: string } | null>(["wallet"], (old) =>
        old ? { ...old, balance: result.value.newBalance } : old,
      );

      // You're in — mark the moment you claimed a spot on the court.
      if (status === "YES") celebrateJoin();
    } catch {
      setPendingStatus(null);
      rollback();
      toast.error("Failed to update RSVP");
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
      // Background sync — no UI blocking
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey });
      // Wallet page has its own cache (balance + timeline) that the RSVP changes
      queryClient.invalidateQueries({ queryKey: ["wallet"], refetchType: "all" });
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
          size="cta"
          className="join-pop bg-brand-foreground shadow-sm disabled:opacity-100"
          style={{ color: "hsl(var(--background))" }}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          You&rsquo;re in!
        </Button>
      ) : isJoined && lateCancelStatus === "PENDING" ? (
        <div className="flex items-center gap-3 rounded-full border border-warning/30 bg-warning-soft py-1.5 pr-1.5 pl-4 shadow-sm">
          <Clock className="h-4 w-4 shrink-0 text-warning" />
          <p className="flex-1 text-sm font-medium text-warning">Cancellation pending approval</p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-background"
            disabled={loading}
            onClick={() =>
              handleQueued(
                () => withdrawLateCancelFn({ data: { sessionId } }),
                ["Request withdrawn", "You're keeping your spot."],
              )
            }
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Keep my spot"}
          </Button>
        </div>
      ) : isJoined && lateCancelStatus === "REJECTED" ? (
        <div className="flex h-11 items-center justify-center gap-2 rounded-full border bg-background px-4 text-center text-sm text-muted-foreground shadow-sm">
          Late cancellation declined · you&rsquo;ll be charged your share
        </div>
      ) : isJoined ? (
        <Button
          onClick={() => setShowLeaveDialog(true)}
          disabled={loading}
          variant="outline"
          size="cta"
          className="border-danger/25 text-danger hover:bg-danger-soft hover:text-danger"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Game"}
        </Button>
      ) : !isLoggedIn ? (
        <Button variant="brand" size="cta" onClick={() => setShowLogin(true)}>
          Sign in
        </Button>
      ) : effectiveStatus === "WAITLIST" ? (
        <div className="flex items-center gap-3 rounded-full border border-brand-foreground/30 bg-brand/40 py-1.5 pr-1.5 pl-4 shadow-sm">
          <p className="flex-1 text-sm font-semibold text-brand-foreground">
            On the waitlist{waitlistPosition ? ` · #${waitlistPosition} in line` : ""}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full bg-background"
            disabled={loading}
            onClick={() => handleQueued(() => rsvpFn({ data: { sessionId, status: "NO" } }))}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave waitlist"}
          </Button>
        </div>
      ) : isFull ? (
        <Button
          onClick={() =>
            hasInsufficientBalance
              ? setShowTopUp(true)
              : handleQueued(() => rsvpFn({ data: { sessionId, status: "WAITLIST" } }))
          }
          variant="brand"
          size="cta"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasInsufficientBalance ? (
            `Top up ${formatCurrency(shortfall.toFixed(2))} to join waitlist`
          ) : (
            "Session full · Join waitlist"
          )}
        </Button>
      ) : (
        <Button
          onClick={() => (hasInsufficientBalance ? setShowTopUp(true) : handleRsvp("YES"))}
          variant="brand"
          size="cta"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasInsufficientBalance ? (
            `Top up ${formatCurrency(shortfall.toFixed(2))} to join`
          ) : (
            "Join Game"
          )}
        </Button>
      )}

      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
      <TopUpDialog open={showTopUp} onOpenChange={setShowTopUp} initialAmount={shortfall} />

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isLateCancel ? "Late cancellation" : "Leave game?"}</DialogTitle>
            <DialogDescription>
              {isLateCancel ? (
                <>
                  It&rsquo;s less than 24 hours to the game, so a host has to approve this. If
                  approved (usually when someone from the waitlist takes your spot),{" "}
                  {deposit > 0
                    ? `your ${formatCurrency(deposit.toFixed(2))} deposit is refunded`
                    : "you're taken off the list"}
                  . If rejected, you stay on the list and your share is deducted from your wallet.
                </>
              ) : deposit > 0 ? (
                `Your ${formatCurrency(deposit.toFixed(2))} deposit will be refunded to your wallet.`
              ) : (
                "You won't be able to undo this."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={loading} onClick={() => handleRsvp("NO")}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLateCancel ? (
                "Request to leave"
              ) : (
                "Leave"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
