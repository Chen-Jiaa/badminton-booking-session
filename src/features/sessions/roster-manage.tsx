import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Loader2, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addPlayerFn,
  memberNamesQueryOptions,
  promoteWaitlistFn,
  removePlayerFn,
  resolveLateCancelFn,
} from "@/features/admin/server";
import { waitlistOrder } from "@/features/sessions/rules";
import { cn, formatCurrency } from "@/lib/utils";

type RosterRow = {
  id: string;
  userId: string;
  status: "YES" | "NO" | "WAITLIST";
  lateCancelStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  lateCancelRequestedAt: Date | null;
  waitlistedAt: Date | null;
  createdAt: Date;
  // Balance is only loaded on the admin console
  user: { id: string; name: string; image: string | null; balance?: string };
};

interface RosterProps {
  sessionId: string;
  maxPlayers: number;
  deposit: number;
  attendances: RosterRow[];
}

function timeAgo(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function PersonAvatar({ user, className }: { user: RosterRow["user"]; className?: string }) {
  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarImage src={user.image || undefined} />
      <AvatarFallback className="bg-brand text-xs text-brand-foreground">
        {user.name?.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function canAfford(user: RosterRow["user"], deposit: number) {
  return user.balance === undefined || parseFloat(user.balance) >= deposit;
}

function useRosterRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["current-user"] }),
    ]);
}

/** Pending late cancellations with approve (optionally swapping in a waitlister) / reject. */
export function LateCancelRequests({ sessionId, deposit, attendances }: RosterProps) {
  const requests = attendances
    .filter((a) => a.status === "YES" && a.lateCancelStatus === "PENDING")
    .sort(
      (a, b) =>
        (a.lateCancelRequestedAt?.getTime() ?? 0) - (b.lateCancelRequestedAt?.getTime() ?? 0),
    );
  const waitlist = waitlistOrder(attendances);
  const [approving, setApproving] = useState<RosterRow | null>(null);
  const [rejecting, setRejecting] = useState<RosterRow | null>(null);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useRosterRefresh();

  if (requests.length === 0) return null;

  function openApprove(row: RosterRow) {
    // Default to the first waitlister who can cover the deposit
    setReplacementId(waitlist.find((w) => canAfford(w.user, deposit))?.userId ?? null);
    setApproving(row);
  }

  async function resolve(row: RosterRow, decision: "APPROVE" | "REJECT") {
    setLoading(true);
    try {
      const result = await resolveLateCancelFn({
        data: {
          sessionId,
          userId: row.userId,
          decision,
          replacementUserId: decision === "APPROVE" ? replacementId : null,
        },
      });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't update request");
        return;
      }
      const swapped = waitlist.find((w) => w.userId === replacementId)?.user.name;
      toast.success(
        decision === "REJECT"
          ? `${row.user.name} stays on and will be charged`
          : swapped
            ? `${row.user.name} refunded · ${swapped} moved in`
            : `${row.user.name} refunded · spot left open`,
      );
      setApproving(null);
      setRejecting(null);
      await refresh();
    } catch {
      toast.error("Couldn't update request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-warning/40 bg-warning-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-warning" />
          Late cancellations
          <span className="font-normal text-muted-foreground">· {requests.length} to review</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3"
          >
            <PersonAvatar user={row.user} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.user.name}</p>
              <p className="text-xs text-muted-foreground">
                Asked to drop out{" "}
                {row.lateCancelRequestedAt ? timeAgo(row.lateCancelRequestedAt) : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRejecting(row)}>
                Reject
              </Button>
              <Button size="sm" variant="brand" onClick={() => openApprove(row)}>
                Approve
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {waitlist.length > 0
            ? `${waitlist.length} on the waitlist can take a freed spot.`
            : "No one on the waitlist yet."}
        </p>
      </CardContent>

      <Dialog open={!!approving} onOpenChange={(open) => !open && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {approving?.user.name}&rsquo;s cancellation?</DialogTitle>
            <DialogDescription>
              {deposit > 0
                ? `Their ${formatCurrency(deposit)} deposit goes back to their wallet.`
                : "They'll be taken off the list."}{" "}
              Choose who takes the spot.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" className="space-y-2">
            {waitlist.map((w, i) => {
              const affordable = canAfford(w.user, deposit);
              const selected = replacementId === w.userId;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!affordable}
                  onClick={() => setReplacementId(w.userId)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    selected ? "border-brand-foreground bg-brand/30" : "hover:bg-muted",
                    !affordable && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <PersonAvatar user={w.user} className="h-7 w-7" />
                  <span className="flex-1 truncate text-sm font-medium">{w.user.name}</span>
                  {!affordable ? (
                    <span className="text-xs text-danger">Low balance</span>
                  ) : (
                    selected && <Check className="h-4 w-4 text-brand-foreground" />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={replacementId === null}
              onClick={() => setReplacementId(null)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors",
                replacementId === null ? "border-brand-foreground bg-brand/30" : "hover:bg-muted",
              )}
            >
              <span className="flex-1">No replacement · leave the spot open</span>
              {replacementId === null && <Check className="h-4 w-4 text-brand-foreground" />}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={loading}
              onClick={() => approving && resolve(approving, "APPROVE")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.user.name}&rsquo;s cancellation?</DialogTitle>
            <DialogDescription>
              They stay on the list, their deposit isn&rsquo;t refunded, and their full share is
              deducted from their wallet when the session is finalized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => rejecting && resolve(rejecting, "REJECT")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** The waitlist in queue order, with "Move in" when a spot is open. */
export function WaitlistPanel({
  sessionId,
  maxPlayers,
  deposit,
  attendances,
  plain = false,
}: RosterProps & { plain?: boolean }) {
  const waitlist = waitlistOrder(attendances);
  const confirmed = attendances.filter((a) => a.status === "YES").length;
  const openSpots = Math.max(0, maxPlayers - confirmed);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const refresh = useRosterRefresh();

  async function promote(row: RosterRow) {
    setPromotingId(row.userId);
    try {
      const result = await promoteWaitlistFn({ data: { sessionId, userId: row.userId } });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't move them in");
        return;
      }
      toast.success(`${row.user.name} moved in`);
      await refresh();
    } catch {
      toast.error("Couldn't move them in");
    } finally {
      setPromotingId(null);
    }
  }

  const spotsOpen = openSpots > 0 && waitlist.length > 0 && (
    <span className="ml-2 text-sm font-normal text-success">
      {openSpots} spot{openSpots > 1 ? "s" : ""} open
    </span>
  );

  const list =
    waitlist.length === 0 ? (
      <p className="py-4 text-center text-muted-foreground">No one is waiting</p>
    ) : (
      <ol className="space-y-2">
        {waitlist.map((w, i) => {
          const affordable = canAfford(w.user, deposit);
          return (
            <li key={w.id} className="flex items-center gap-3 border-b py-2 last:border-0">
              <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                #{i + 1}
              </span>
              <PersonAvatar user={w.user} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{w.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {timeAgo(w.waitlistedAt ?? w.createdAt)}
                  {w.user.balance !== undefined && (
                    <span className={cn(!affordable && "font-medium text-danger")}>
                      {" "}
                      · Balance {formatCurrency(w.user.balance)}
                    </span>
                  )}
                </p>
              </div>
              {openSpots > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!affordable || promotingId !== null}
                  onClick={() => promote(w)}
                >
                  {promotingId === w.userId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Move in"
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    );

  if (plain) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">
          Waitlist
          <span className="font-normal text-muted-foreground ml-1">
            · {waitlist.length} waiting
          </span>
          {spotsOpen}
        </p>
        {list}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Waitlist ({waitlist.length}){spotsOpen}
        </CardTitle>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}

/** Add someone who turned up without RSVPing. They're charged their share at finalize. */
export function AddWalkInButton({
  sessionId,
  attendances,
}: {
  sessionId: string;
  attendances: RosterRow[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useRosterRefresh();
  const { data: members = [] } = useQuery({ ...memberNamesQueryOptions(), enabled: open });
  const confirmedIds = new Set(attendances.filter((a) => a.status === "YES").map((a) => a.userId));
  const candidates = members
    .filter((m) => !confirmedIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function add() {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await addPlayerFn({ data: { sessionId, userId } });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't add player");
        return;
      }
      toast.success(`${candidates.find((m) => m.id === userId)?.name ?? "Player"} added`);
      setOpen(false);
      setUserId("");
      await refresh();
    } catch {
      toast.error("Couldn't add player");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4 mr-1.5" />
        Add walk-in
      </Button>
      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a walk-in player</DialogTitle>
            <DialogDescription>
              No deposit is taken now. They&rsquo;re charged their share when you finalize.
            </DialogDescription>
          </DialogHeader>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" disabled={loading} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={!userId || loading} onClick={add}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Confirm before taking someone off the roster; their held deposit is refunded. */
export function RemovePlayerDialog({
  sessionId,
  player,
  onClose,
}: {
  sessionId: string;
  player: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const refresh = useRosterRefresh();

  async function remove() {
    if (!player) return;
    setLoading(true);
    try {
      const result = await removePlayerFn({ data: { sessionId, userId: player.id } });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't remove player");
        return;
      }
      toast.success(`${player.name} removed`);
      onClose();
      await refresh();
    } catch {
      toast.error("Couldn't remove player");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!player} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {player?.name}?</DialogTitle>
          <DialogDescription>
            Any deposit they paid goes back to their wallet, and they won&rsquo;t be charged for
            this session.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={loading} onClick={onClose}>
            Keep
          </Button>
          <Button variant="destructive" disabled={loading} onClick={remove}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
