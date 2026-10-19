import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  const queryClient = useQueryClient();

  function handleDeleted() {
    queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sessions.map((s) => {
        const yesCount = s.attendances.filter((a) => a.status === "YES").length;
        const waitlistCount = s.attendances.filter((a) => a.status === "WAITLIST").length;
        const lateCancelCount = s.attendances.filter(
          (a) => a.status === "YES" && a.lateCancelStatus === "PENDING",
        ).length;
        return (
          <Card key={s.id} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-2">
                <Link to="/admin/sessions/$id" params={{ id: s.id }} className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{formatDateTime(s.startTime)}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.courts} court{s.courts > 1 ? "s" : ""} • {yesCount} confirmed
                      {waitlistCount > 0 && ` • ${waitlistCount} waitlisted`}
                    </p>
                    {lateCancelCount > 0 && (
                      <p className="text-sm font-medium text-warning">
                        {lateCancelCount} late cancellation{lateCancelCount > 1 ? "s" : ""} to
                        review
                      </p>
                    )}
                    {s.costPerPlayer && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(s.costPerPlayer)}/person
                      </p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "LOCKED" ? "default" : "secondary"}>
                    {s.status}
                  </Badge>
                  <DeleteSessionButton sessionId={s.id} isLocked={s.status === "LOCKED"} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
