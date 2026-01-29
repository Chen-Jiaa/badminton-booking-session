import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type SessionCardProps = {
  session: {
    id: string;
    startTime: Date;
    courts: number;
    status: string;
  };
  userRsvp?: {
    status: string;
  } | null;
  showStatus?: boolean;
};

export function SessionCard({ session, userRsvp, showStatus = false }: SessionCardProps) {
  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{formatDateTime(session.startTime)}</p>
              <p className="text-sm text-muted-foreground">
                {session.courts} court{session.courts > 1 ? "s" : ""}
                {showStatus && ` • ${session.status}`}
              </p>
            </div>
            <div className="text-right">
              {userRsvp ? (
                <Badge variant={userRsvp.status === "YES" ? "success" : "secondary"}>
                  {userRsvp.status}
                </Badge>
              ) : (
                <Badge variant="outline">RSVP</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
