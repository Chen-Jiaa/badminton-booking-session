import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JoinBurst } from "@/features/sessions/join-celebration";
import { cn, CLUB_TIME_ZONE } from "@/lib/utils";
import { AvatarStack } from "./controls";
import {
  isExpired,
  isWaitingOn,
  sideOf,
  waitingSide,
  winnerSide,
  type MatchStatus,
  type MatchView,
} from "./logic";

const STATUS: Record<MatchStatus | "EXPIRED", { label: string; className: string }> = {
  INVITED: { label: "Invite sent", className: "bg-warning-soft text-warning" },
  IN_PLAY: { label: "In play", className: "bg-brand text-brand-foreground" },
  AWAITING_CONFIRM: { label: "Awaiting confirmation", className: "bg-warning-soft text-warning" },
  CONFIRMED: { label: "Confirmed", className: "bg-success-soft text-success" },
  DECLINED: { label: "Declined", className: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

function formatTime(date: Date) {
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

export function MatchCard({
  match: m,
  meId,
  canReferee = false,
  busy,
  celebrating,
  recordingOpen,
  onAccept,
  onDecline,
  onConfirm,
  onDispute,
  onEnterResult,
  onDelete,
}: {
  match: MatchView;
  meId: string | undefined;
  /** Host of this session or an admin: may answer a match nobody on the waiting side can. */
  canReferee?: boolean;
  /** A response for this match is in flight. */
  busy: boolean;
  /** Just confirmed: play the stamp / trophy moment. */
  celebrating: boolean;
  /** Scores can still be entered for this session (start to end + grace). */
  recordingOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onConfirm: () => void;
  onDispute: () => void;
  onEnterResult: () => void;
  onDelete: () => void;
}) {
  const expired = isExpired(m);
  const settled = m.status === "CONFIRMED";
  const waiting = expired ? null : waitingSide(m);
  const mine = !!meId && isWaitingOn(m, meId, new Date(), canReferee);
  const mySide = meId ? sideOf(m, meId) : null;
  const winner = winnerSide(m);
  // My result, shown as the stamp; null when I didn't play or there's no score yet
  const result = mySide && winner ? (winner === mySide ? "WIN" : "LOSS") : null;
  const won = result === "WIN";
  const status = STATUS[expired ? "EXPIRED" : m.status];

  const side = (s: "A" | "B") => m.players.filter((p) => p.side === s);
  const names = (s: "A" | "B") =>
    side(s)
      .map((p) => (p.userId === meId ? "You" : p.name))
      .join(" & ");
  const nameOf = (id: string | null) =>
    id === meId ? "You" : (m.players.find((p) => p.userId === id)?.name ?? "Someone");
  const recorder = nameOf(m.submittedById ?? m.createdById);
  const hasPrevious = m.previousScoreA !== null && m.previousScoreB !== null;

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        mine && "border-warning/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", status.className)}
        >
          {status.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {m.format === "DOUBLES" ? "Doubles" : "Singles"} · {formatTime(m.createdAt)}
        </span>
      </div>

      {(["A", "B"] as const).map((s) => {
        const sideWon = winner === s;
        const score = s === "A" ? m.scoreA : m.scoreB;
        return (
          <div key={s} className="relative flex items-center gap-2 py-1">
            <AvatarStack
              people={side(s).map((p) => ({ name: p.name, image: p.image }))}
              className="h-7 w-7"
            />
            <p
              className={cn(
                "flex-1 truncate text-sm",
                sideWon ? "font-semibold" : "text-muted-foreground",
                // Leave room for the stamp
                result && "pr-20",
              )}
            >
              {names(s)}
            </p>
            {sideWon && settled && !result && (
              <Trophy className={cn("h-4 w-4 text-brand-foreground", celebrating && "join-pop")} />
            )}
            <span
              className={cn(
                "w-7 text-right text-lg font-bold tabular-nums",
                !sideWon && "text-muted-foreground",
              )}
            >
              {score ?? "–"}
            </span>
            {celebrating && sideWon && !result && <JoinBurst />}
          </div>
        );
      })}

      {hasPrevious && m.status === "AWAITING_CONFIRM" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {nameOf(m.submittedById)} corrected the score · was{" "}
          <span className="line-through">
            {m.previousScoreA}–{m.previousScoreB}
          </span>
        </p>
      )}

      {/* Footer: what happens next */}
      {mine && m.status === "INVITED" && (
        <Actions
          note={`${recorder} invited you to play`}
          busy={busy}
          secondary={{ label: "Decline", onClick: onDecline }}
          primary={{ label: "Accept", onClick: onAccept }}
        />
      )}
      {mine && m.status === "AWAITING_CONFIRM" && (
        <Actions
          note={
            hasPrevious
              ? `${recorder} says this is the right score`
              : `${recorder} recorded this result`
          }
          busy={busy}
          secondary={{ label: "Dispute", onClick: onDispute }}
          primary={{ label: "Confirm", onClick: onConfirm }}
        />
      )}
      {m.status === "IN_PLAY" && mySide && recordingOpen && (
        <Actions
          note="Done playing? Either side can add the score."
          busy={busy}
          primary={{ label: "Enter result", onClick: onEnterResult }}
        />
      )}
      {/* Too late to score it, so it can never count: let the players clear it away */}
      {m.status === "IN_PLAY" && mySide && !recordingOpen && (
        <Actions
          note="It's too late to add a score for this match."
          busy={busy}
          secondary={{ label: "Delete match", onClick: onDelete }}
        />
      )}
      {waiting && !mine && (
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Waiting for {names(waiting)}
        </p>
      )}

      {/* Stamp: my result over the players, thumped down when it's confirmed */}
      {result && (
        <div className="pointer-events-none absolute right-12 top-11">
          <div
            className={cn(
              "rounded border-[1.5px] px-1.5 py-px text-xs font-semibold uppercase tracking-[0.2em]",
              won
                ? "border-brand-foreground text-brand-foreground"
                : "border-gray-400 text-gray-400",
              settled ? "bg-white/70" : "border-dashed opacity-50",
              celebrating ? "stamp-land" : "-rotate-12",
            )}
          >
            {won ? "Won" : "Lost"}
            {!settled && "?"}
          </div>
          {celebrating && won && <JoinBurst />}
        </div>
      )}
    </div>
  );
}

function Actions({
  note,
  busy,
  primary,
  secondary,
}: {
  note: string;
  busy: boolean;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mt-2 flex items-center gap-2 border-t pt-2">
      <p className="flex-1 text-xs text-muted-foreground">{note}</p>
      {secondary && (
        <Button size="sm" variant="outline" disabled={busy} onClick={secondary.onClick}>
          {secondary.label}
        </Button>
      )}
      {primary && (
        <Button size="sm" variant="brand" disabled={busy} onClick={primary.onClick}>
          {primary.label}
        </Button>
      )}
    </div>
  );
}
