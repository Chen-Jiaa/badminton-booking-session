import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreStepper } from "./controls";
import { scoreProblem, type MatchView } from "./logic";

export type ResultMode = "enter" | "dispute";

/**
 * Enter a score for a match in play, or dispute one by entering the score you
 * think is right. A dispute goes back to the other side to confirm.
 */
export function ResultDialog({
  match,
  mode,
  meId,
  submitting,
  onClose,
  onSubmit,
  onNotPlayed,
}: {
  match: MatchView | null;
  mode: ResultMode;
  meId: string | undefined;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (score: [number, number]) => void;
  onNotPlayed: () => void;
}) {
  const [score, setScore] = useState<[number, number]>([21, 15]);
  const original: [number, number] | null =
    match && match.scoreA !== null && match.scoreB !== null ? [match.scoreA, match.scoreB] : null;

  // Start from the recorded score when correcting it, so only the wrong part needs changing.
  useEffect(() => {
    if (match) setScore(original ?? [21, 15]);
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unchanged =
    mode === "dispute" && !!original && original[0] === score[0] && original[1] === score[1];
  const problem = scoreProblem(score[0], score[1]);
  const names = (side: "A" | "B") =>
    (match?.players ?? [])
      .filter((p) => p.side === side)
      .map((p) => (p.userId === meId ? "You" : p.name))
      .join(" & ");
  const recorderId = match?.submittedById ?? match?.createdById;
  const recorder = match?.players.find((p) => p.userId === recorderId)?.name ?? "They";

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="focus:outline-none">
        <DialogHeader>
          <DialogTitle>
            {mode === "dispute" ? "What was the real score?" : "Enter result"}
          </DialogTitle>
          <DialogDescription>
            {mode === "dispute" && original
              ? `${recorder} put ${original[0]}–${original[1]}. Fix it and ${recorder} confirms your version.`
              : "The other side confirms before it counts."}
          </DialogDescription>
        </DialogHeader>
        {match && (
          <div className="flex items-start justify-center gap-4 py-2">
            <ScoreStepper
              label={names("A")}
              value={score[0]}
              emphasis={score[0] > score[1]}
              onChange={(n) => setScore([n, score[1]])}
            />
            <ScoreStepper
              label={names("B")}
              value={score[1]}
              emphasis={score[1] > score[0]}
              onChange={(n) => setScore([score[0], n])}
            />
          </div>
        )}
        <Button
          variant="brand"
          size="cta"
          disabled={!!problem || unchanged || submitting}
          onClick={() => onSubmit(score)}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {problem ??
            (unchanged
              ? "Change the score to send it"
              : mode === "dispute"
                ? `Send ${score[0]}–${score[1]} to ${recorder}`
                : "Send for confirmation")}
        </Button>
        {mode === "dispute" && (
          <button
            type="button"
            disabled={submitting}
            onClick={onNotPlayed}
            className="-mt-1 text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            We didn't play this match
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
