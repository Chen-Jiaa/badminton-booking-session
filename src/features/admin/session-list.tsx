import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { DeleteSessionButton } from "@/features/admin/delete-session-button";

interface Session {
  id: string;
  startTime: Date;
  courts: number;
  costPerPlayer: string | null;
  status: "OPEN" | "LOCKED";
  attendances: { status: string; lateCancelStatus: string | null }[];
}

interface SessionListProps {
  sessions: Session[];
}

export function SessionList({ sessions }: SessionListProps) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-white">
      {sessions.map((s) => {
        const yesCount = s.attendances.filter((a) => a.status === "YES").length;
        const waitlistCount = s.attendances.filter((a) => a.status === "WAITLIST").length;
        const lateCancelCount = s.attendances.filter(
          (a) => a.status === "YES" && a.lateCancelStatus === "PENDING",
        ).length;
        return (
          <li key={s.id} className="flex items-center gap-2 pr-3 hover:bg-muted/40">
            <Link
              to="/admin/sessions/$id"
              params={{ id: s.id }}
              className="min-w-0 flex-1 px-4 py-3"
            >
              <p className="truncate font-medium">{formatDateTime(s.startTime)}</p>
              <p className="truncate text-sm text-muted-foreground">
                {s.courts} court{s.courts > 1 ? "s" : ""} • {yesCount} confirmed
                {waitlistCount > 0 && ` • ${waitlistCount} waitlisted`}
                {s.costPerPlayer && ` • ${formatCurrency(s.costPerPlayer)}/person`}
              </p>
              {lateCancelCount > 0 && (
                <p className="text-sm font-medium text-warning">
                  {lateCancelCount} late cancellation{lateCancelCount > 1 ? "s" : ""} to review
                </p>
              )}
            </Link>
            <Badge variant={s.status === "LOCKED" ? "default" : "secondary"}>{s.status}</Badge>
            <DeleteSessionButton sessionId={s.id} isLocked={s.status === "LOCKED"} />
          </li>
        );
      })}
    </ul>
  );
}
