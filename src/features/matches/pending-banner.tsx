import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

/** "A match is waiting for you": links to the session that has a match to accept or confirm. */
export function PendingMatchesBanner({
  sessionId,
  count,
}: {
  sessionId: string | null | undefined;
  count: number | null | undefined;
}) {
  if (!sessionId) return null;
  return (
    <Link
      to="/sessions/$id"
      params={{ id: sessionId }}
      className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning transition-[scale] active:scale-[0.98]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
      <span className="flex-1">
        {count === 1 ? "A match is waiting for you" : `${count} matches are waiting for you`}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}
