import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HelpLink } from "@/features/faq/help-link";
import { TopUpDialog } from "@/features/topup/topup-dialog";
import { currentUserQueryOptions } from "@/features/auth/server";
import { deleteGuestFn, myGuestsQueryOptions, updateGuestsFn } from "@/features/sessions/server";
import { GUEST_LIMIT } from "@/features/sessions/rules";
import { formatCurrency } from "@/lib/utils";

/** The slice of a session attendance this section needs. */
export interface GuestAttendance {
  userId: string;
  status: "YES" | "NO" | "WAITLIST";
  lateCancelStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  user: { name: string; sponsorId: string | null };
}

interface DraftGuest {
  key: string;
  name: string;
  /** Saved guest id; absent for a friend typed in just now */
  guestId?: string;
  status?: "YES" | "WAITLIST";
  lateCancelStatus?: GuestAttendance["lateCancelStatus"];
}

interface Props {
  sessionId: string;
  userId: string;
  attendances: GuestAttendance[];
  deposit: number;
  maxPlayers: number;
  /** New friends can be added: before the deadline and start, or after the start while seats are free */
  canAdd: boolean;
  /** Inside the late-cancel window: removing a confirmed friend is a request, not a refund */
  isLateCancel: boolean;
  /** Whether the sponsor themselves is going, to word the "you left" note */
  iAmGoing: boolean;
}

let draftCount = 0;
const nextKey = () => `d${++draftCount}`;

/**
 * "Your guests" on the session page: bring friends who don't have an account, and
 * manage them later, even after leaving the game yourself. You pay for them.
 */
export function GuestsSection({
  sessionId,
  userId,
  attendances,
  deposit,
  maxPlayers,
  canAdd,
  isLateCancel,
  iAmGoing,
}: Props) {
  const [open, setOpen] = useState(false);
  const mine = attendances.filter(
    (a) => a.user.sponsorId === userId && (a.status === "YES" || a.status === "WAITLIST"),
  );
  if (mine.length === 0 && !canAdd) return null;

  const held = mine.filter((a) => a.status === "YES").length * deposit;
  return (
    <div className="py-4 border-b space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1 text-sm font-semibold">
          Your guests
          {mine.length > 0 && (
            <span className="font-normal text-muted-foreground ml-1">
              · {mine.length}/{GUEST_LIMIT}
            </span>
          )}
          <HelpLink q="guests-deposit" label="How guests and deposits work" />
        </p>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          {mine.length > 0 ? (
            "Manage"
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Bring a friend
            </>
          )}
        </Button>
      </div>
      {mine.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Friend without an account? Add them by name and you pay for them
          {deposit > 0 ? ` (${formatCurrency(deposit.toFixed(2))} deposit each)` : ""}.
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {mine.map((a) => (
              <li
                key={a.userId}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pr-3 pl-1 text-sm"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
                  {a.user.name.charAt(0).toUpperCase()}
                </span>
                {a.user.name}
                {a.status === "WAITLIST" && (
                  <span className="text-[11px] font-semibold text-warning">Waitlist</span>
                )}
                {a.lateCancelStatus === "PENDING" && (
                  <span className="text-[11px] font-semibold text-warning">Wants out</span>
                )}
              </li>
            ))}
          </ul>
          {held > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(held.toFixed(2))} held from your wallet.
            </p>
          )}
          {!iAmGoing && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              You&rsquo;re not on this game, but your{" "}
              {mine.length === 1 ? "guest stays" : "guests stay"} and you&rsquo;ll still pay their
              share. Remove them from Manage if they can&rsquo;t come.
            </p>
          )}
        </>
      )}

      {open && (
        <GuestsSheet
          open={open}
          onOpenChange={setOpen}
          sessionId={sessionId}
          current={mine}
          deposit={deposit}
          maxPlayers={maxPlayers}
          yesCount={attendances.filter((a) => a.status === "YES").length}
          canAdd={canAdd}
          isLateCancel={isLateCancel}
        />
      )}
    </div>
  );
}

function GuestsSheet({
  open,
  onOpenChange,
  sessionId,
  current,
  deposit,
  maxPlayers,
  yesCount,
  canAdd,
  isLateCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string;
  current: GuestAttendance[];
  deposit: number;
  maxPlayers: number;
  yesCount: number;
  canAdd: boolean;
  isLateCancel: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(currentUserQueryOptions());
  const { data: past = [] } = useQuery(myGuestsQueryOptions());
  const [draft, setDraft] = useState<DraftGuest[]>(() =>
    current.map((a) => ({
      key: a.userId,
      guestId: a.userId,
      name: a.user.name,
      status: a.status as "YES" | "WAITLIST",
      lateCancelStatus: a.lateCancelStatus,
    })),
  );
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const lower = (s: string) => s.trim().toLowerCase();
  const has = (name: string) => draft.some((g) => lower(g.name) === lower(name));
  const full = draft.length >= GUEST_LIMIT;
  const adding = draft.filter((g) => !g.status);
  const removing = current.filter((a) => !draft.some((g) => g.guestId === a.userId));
  const changed = adding.length > 0 || removing.length > 0;

  // Seats free right now decide who is charged up front; the rest wait in line
  const freeSeats = Math.max(
    0,
    maxPlayers - yesCount + removing.filter((a) => a.status === "YES").length,
  );
  const holdNow = Math.min(adding.length, freeSeats) * deposit;
  // Removing a confirmed friend refunds their deposit first (the server does removals
  // before charging), unless it's a late cancel, which waits for approval
  const refunds = isLateCancel ? 0 : removing.filter((a) => a.status === "YES").length * deposit;
  const balance = (me ? parseFloat(me.balance) : 0) + refunds;
  // Every new friend needs a deposit on hand, even one who ends up on the waitlist
  const shortfall = Math.max(0, Math.ceil(adding.length * deposit - balance));

  function add(name: string, guestId?: string) {
    const clean = name.trim();
    if (!clean || full || has(clean)) return;
    setDraft((d) => [...d, { key: nextKey(), name: clean, guestId }]);
    setText("");
  }

  async function deleteFriend(id: string, name: string) {
    try {
      const result = await deleteGuestFn({ data: { guestId: id } });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Couldn't delete your friend");
        return;
      }
      toast.success(`${name} deleted from your list`);
      await queryClient.invalidateQueries({ queryKey: ["my-guests"] });
    } catch {
      toast.error("Couldn't delete your friend");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function save() {
    if (shortfall > 0) {
      setShowTopUp(true);
      return;
    }
    setSaving(true);
    try {
      const result = await updateGuestsFn({
        data: {
          sessionId,
          add: adding.map((g) => ({ name: g.name, guestId: g.guestId })),
          remove: removing.map((a) => a.userId),
        },
      });
      if (result.type !== "SUCCESS") {
        const code = result.type === "BUSINESS_ERROR" ? result.code : "Couldn't save your guests";
        toast.error(code === "INSUFFICIENT_BALANCE" ? "Not enough balance for the deposit" : code);
        return;
      }
      const o = result.value;
      const parts = [
        o.added > 0 && `${o.added} in`,
        o.waitlisted > 0 && `${o.waitlisted} on the waitlist`,
        o.removed > 0 && `${o.removed} removed`,
        o.requested > 0 &&
          `${o.requested} cancellation${o.requested === 1 ? "" : "s"} sent for approval`,
      ].filter(Boolean);
      toast.success("Guests saved", { description: parts.join(" · ") || undefined });
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["my-guests"] }),
        queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["wallet"], refetchType: "all" }),
      ]);
    } catch {
      toast.error("Couldn't save your guests");
    } finally {
      setSaving(false);
    }
  }

  const suggestions = past.filter((p) => !has(p.name));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who&rsquo;s coming with you?</DialogTitle>
            <DialogDescription>
              Your friends don&rsquo;t need an account. You pay for them, and they show up on the
              leaderboard under the name you give.
            </DialogDescription>
          </DialogHeader>

          {canAdd && suggestions.length > 0 && !full && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Brought before</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((p) =>
                  confirmDelete === p.id ? (
                    <span
                      key={p.id}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-destructive/40 bg-background pr-1 pl-3 text-sm"
                    >
                      Delete {p.name}?
                      <button
                        type="button"
                        onClick={() => deleteFriend(p.id, p.name)}
                        className="h-7 rounded-full bg-destructive px-2.5 text-xs font-semibold text-white active:scale-95"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="h-7 rounded-full px-2 text-xs text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span
                      key={p.id}
                      className="inline-flex h-9 items-center rounded-full border bg-background text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => add(p.name, p.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-l-full pr-1 pl-3 transition-[scale] duration-150 active:scale-95"
                      >
                        {p.name}
                        <Plus className="h-3.5 w-3.5 text-brand-foreground" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name} from your list`}
                        onClick={() => setConfirmDelete(p.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-r-full text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {canAdd && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add(text);
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="New friend's name"
                aria-label="New friend's name"
                maxLength={30}
                disabled={full}
              />
              <Button type="submit" variant="brand" disabled={!text.trim() || full || has(text)}>
                Add
              </Button>
            </form>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {draft.length} of {GUEST_LIMIT} friends
            </p>
            <ul className="divide-y rounded-2xl border">
              {draft.length === 0 && (
                <li className="p-4 text-center text-sm text-muted-foreground">
                  No friends added yet
                </li>
              )}
              {draft.map((g) => (
                <li key={g.key} className="flex items-center gap-3 p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                  {g.lateCancelStatus === "PENDING" ? (
                    <span className="text-[11px] font-semibold text-warning">Wants out</span>
                  ) : g.lateCancelStatus === "REJECTED" ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Still on
                    </span>
                  ) : g.status === "WAITLIST" ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                      Waitlist
                    </span>
                  ) : g.status === "YES" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/50 px-2 py-0.5 text-[11px] font-semibold text-brand-foreground">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      In
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">New</span>
                  )}
                  {g.lateCancelStatus !== "PENDING" && g.lateCancelStatus !== "REJECTED" && (
                    <button
                      type="button"
                      aria-label={`Remove ${g.name}`}
                      onClick={() => setDraft((d) => d.filter((x) => x.key !== g.key))}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-[scale] duration-150 hover:bg-muted active:scale-95"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {deposit > 0 && changed && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Deposit held from your wallet now</span>
              <b>{formatCurrency(holdNow.toFixed(2))}</b>
            </div>
          )}
          {adding.length > freeSeats && (
            <p className="text-xs text-muted-foreground">
              The game is nearly full: friends beyond {freeSeats} join the waitlist and pay their
              deposit if a spot opens.
            </p>
          )}
          {removing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Inside 24h of the game, removing a friend needs a host to approve it.
            </p>
          )}

          <DialogFooter>
            <Button variant="brand" size="cta" disabled={!changed || saving} onClick={save}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : shortfall > 0 ? (
                `Top up ${formatCurrency(shortfall.toFixed(2))} to continue`
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TopUpDialog open={showTopUp} onOpenChange={setShowTopUp} initialAmount={shortfall} />
    </>
  );
}
