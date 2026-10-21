import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { currentUserQueryOptions } from "@/features/auth/server";
import { CourtRecorder, type Attendee, type MatchDraft } from "./court-recorder";
import { createMatchFn } from "./server";

type Outcome =
  | { type: "SUCCESS" }
  | { type: "AUTH_ERROR" | "FORBIDDEN" | "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

export function errorMessage(result: Outcome, fallback: string) {
  if (result.type === "BUSINESS_ERROR") return result.code;
  if (result.type === "AUTH_ERROR") return "Please sign in first";
  if (result.type === "FORBIDDEN") return "You can't do that for this match";
  if (result.type === "NOT_FOUND") return "That match no longer exists";
  return fallback;
}

/**
 * The "Record match" court sheet, for a session you're in. Used on the session page and
 * straight from the live card on the sessions list. Render it outside any clickable
 * card: events from a dialog bubble up to the component that rendered it.
 */
export function RecordMatchDialog({
  sessionId,
  me,
  attendees,
  open,
  onOpenChange,
}: {
  sessionId: string;
  me: Attendee;
  /** Everyone with a YES RSVP (you are filtered out). */
  attendees: Attendee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  // Every recording starts from a blank court: remount the recorder each time it opens
  const [run, setRun] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRun((n) => n + 1);
  }

  async function recordMatch(draft: MatchDraft) {
    setCreating(true);
    try {
      const result = await createMatchFn({ data: { sessionId, ...draft } });
      if (result.type !== "SUCCESS") {
        toast.error(errorMessage(result, "Couldn't record the match"));
        return;
      }
      onOpenChange(false);
      toast.success(draft.score ? "Sent for confirmation" : "Invite sent");
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey });
    } catch {
      toast.error("Couldn't record the match");
    } finally {
      setCreating(false);
    }
  }

  return (
    <CourtRecorder
      key={run}
      open={open}
      onOpenChange={onOpenChange}
      me={me}
      attendees={attendees.filter((a) => a.id !== me.id)}
      submitting={creating}
      onSubmit={recordMatch}
    />
  );
}
