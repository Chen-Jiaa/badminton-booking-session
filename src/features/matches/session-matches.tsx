import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currentUserQueryOptions } from "@/features/auth/server";
import type { Attendee } from "./court-recorder";
import { RecordMatchDialog, errorMessage } from "./record-match-dialog";
import { MatchCard } from "./match-card";
import { ResultDialog, type ResultMode } from "./result-dialog";
import { RECORDING_GRACE_MS, isWaitingOn, sideOf, winnerSide, type MatchView } from "./logic";
import {
  deleteMatchFn,
  respondToMatchFn,
  sessionMatchesQueryOptions,
  submitMatchResultFn,
} from "./server";

/** The Matches section on a session page: record games, answer invites, confirm results. */
export function SessionMatches({
  sessionId,
  startTime,
  endTime,
  me,
  viewerId,
  attendees,
  stickyRecord = false,
  canReferee = false,
}: {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  /** The signed-in player, if they're going to this session. */
  me: Attendee | null;
  /** The signed-in user even when not going: a host or admin can still referee. */
  viewerId?: string;
  /** Everyone with a YES RSVP. */
  attendees: Attendee[];
  /** Pin "Record match" to the bottom of the screen instead of placing it inline. */
  stickyRecord?: boolean;
  /** Host of this session or an admin: can answer matches nobody else can. */
  canReferee?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: matches = [] } = useQuery(sessionMatchesQueryOptions(sessionId));
  const [recording, setRecording] = useState(false);
  const [resultFor, setResultFor] = useState<{ match: MatchView; mode: ResultMode } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    },
    [],
  );

  const meId = me?.id ?? viewerId;
  const now = new Date();
  const recordingOpen = now >= startTime && now.getTime() <= endTime.getTime() + RECORDING_GRACE_MS;
  const canRecord = !!me && recordingOpen;
  const waitingOnMe = meId
    ? matches.filter((m) => isWaitingOn(m, meId, new Date(), canReferee))
    : [];

  // Tonight's record from my side, confirmed matches only
  const tally = { WIN: 0, LOSS: 0 };
  for (const m of matches) {
    const mySide = meId ? sideOf(m, meId) : null;
    const winner = winnerSide(m);
    if (m.status === "CONFIRMED" && mySide && winner) tally[winner === mySide ? "WIN" : "LOSS"]++;
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["matches"] });
    queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey });
  }

  async function respond(m: MatchView, action: "accept" | "decline" | "confirm") {
    setBusyId(m.id);
    try {
      const result = await respondToMatchFn({ data: { matchId: m.id, action } });
      if (result.type !== "SUCCESS") {
        toast.error(errorMessage(result, "Couldn't update the match"));
        return;
      }
      if (action === "confirm") {
        navigator.vibrate?.([12, 28, 16]);
        setCelebrate(m.id);
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebrate(null), 1500);
      }
      setResultFor(null);
      refresh();
    } catch {
      toast.error("Couldn't update the match");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMatch(m: MatchView) {
    setBusyId(m.id);
    try {
      const result = await deleteMatchFn({ data: { matchId: m.id } });
      if (result.type !== "SUCCESS") {
        toast.error(errorMessage(result, "Couldn't delete the match"));
        return;
      }
      toast.success("Match deleted");
      refresh();
    } catch {
      toast.error("Couldn't delete the match");
    } finally {
      setBusyId(null);
    }
  }

  async function submitResult(score: [number, number]) {
    if (!resultFor) return;
    const { match, mode } = resultFor;
    setBusyId(match.id);
    try {
      const result = await submitMatchResultFn({
        data: { matchId: match.id, mode, scoreA: score[0], scoreB: score[1] },
      });
      if (result.type !== "SUCCESS") {
        toast.error(errorMessage(result, "Couldn't save the score"));
        return;
      }
      setResultFor(null);
      toast.success(mode === "dispute" ? "Corrected score sent" : "Sent for confirmation");
      refresh();
    } catch {
      toast.error("Couldn't save the score");
    } finally {
      setBusyId(null);
    }
  }

  function startRecording() {
    setRecording(true);
  }

  function showWaiting() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`match-${waitingOnMe[0].id}`)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  // Nothing to show before play starts, or for people who can't record and see no matches
  if (now < startTime || (!canRecord && matches.length === 0)) return null;

  return (
    <section className="space-y-3 border-t py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-foreground">Matches</p>
        {me && tally.WIN + tally.LOSS > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold tabular-nums">
            <span className="rounded-full bg-brand px-2 py-0.5 text-brand-foreground">
              {tally.WIN}W
            </span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">
              {tally.LOSS}L
            </span>
          </span>
        )}
      </div>

      {waitingOnMe.length > 0 && (
        <button
          type="button"
          onClick={showWaiting}
          className="flex w-full items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-left text-sm text-warning"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
          <span className="flex-1">
            {waitingOnMe.length === 1 ? "1 match is" : `${waitingOnMe.length} matches are`} waiting
            for you
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      )}

      {canRecord && !stickyRecord && (
        <Button variant="brand" size="cta" onClick={startRecording}>
          <Plus className="h-4 w-4" />
          Record match
        </Button>
      )}

      {canRecord && stickyRecord && (
        <div
          className="fixed left-0 right-0 z-10 pointer-events-none"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="container mx-auto max-w-lg px-4 pointer-events-auto">
            <Button variant="brand" size="cta" onClick={startRecording}>
              <Plus className="h-4 w-4" />
              Record match
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {matches.map((m) => (
          <div key={m.id} id={`match-${m.id}`} className="scroll-mt-20">
            <MatchCard
              match={m}
              meId={meId}
              canReferee={canReferee}
              busy={busyId === m.id}
              celebrating={celebrate === m.id}
              recordingOpen={recordingOpen}
              onAccept={() => respond(m, "accept")}
              onDecline={() => respond(m, "decline")}
              onConfirm={() => respond(m, "confirm")}
              onDispute={() => setResultFor({ match: m, mode: "dispute" })}
              onEnterResult={() => setResultFor({ match: m, mode: "enter" })}
              onDelete={() => deleteMatch(m)}
            />
          </div>
        ))}
      </div>

      {me && (
        <RecordMatchDialog
          sessionId={sessionId}
          me={me}
          attendees={attendees}
          open={recording}
          onOpenChange={setRecording}
        />
      )}

      <ResultDialog
        match={resultFor?.match ?? null}
        mode={resultFor?.mode ?? "enter"}
        meId={meId}
        submitting={!!resultFor && busyId === resultFor.match.id}
        onClose={() => setResultFor(null)}
        onSubmit={submitResult}
        onNotPlayed={() => resultFor && respond(resultFor.match, "decline")}
      />
    </section>
  );
}
