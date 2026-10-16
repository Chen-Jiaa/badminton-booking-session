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
import { Check, Loader2 } from "lucide-react";
import { LoginDialog } from "@/features/sessions/login-dialog";
import { rsvpFn, sessionDetailQueryOptions } from "@/features/sessions/server";
import { currentUserQueryOptions } from "@/features/auth/server";
import { formatCurrency } from "@/lib/utils";
import { JoinBurst, useJoinCelebration } from "@/features/sessions/join-celebration";

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
  const { celebrating, celebrateJoin } = useJoinCelebration();
  const queryClient = useQueryClient();

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
        toast.error("Please sign in to RSVP");
        setShowLogin(true);
        return;
      }

      if (result.type !== "SUCCESS") {
        setPendingStatus(null);
        rollback();
        if (result.type === "BUSINESS_ERROR" && result.code === "INSUFFICIENT_BALANCE") {
          toast.error("Not enough balance", {
            description: deposit > 0
              ? `You need ${formatCurrency(deposit.toFixed(2))} to join. Top up your wallet first.`
              : "Top up your wallet to join this session.",
          });
        } else {
          toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Failed to update RSVP");
        }
        return;
      }

      // Confirm balance from server response — no refetch needed
      queryClient.setQueryData(
        currentUserQueryOptions().queryKey,
        (old: typeof prevUserData) => old ? { ...old, balance: result.value.newBalance } : old,
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
      ) : (
        <Button
          onClick={() => handleRsvp("YES")}
          variant="brand"
          size="cta"
          disabled={loading || isFull || hasInsufficientBalance}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isFull ? (
            "Session full"
          ) : hasInsufficientBalance ? (
            "Insufficient balance"
          ) : (
            "Join Game"
          )}
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
