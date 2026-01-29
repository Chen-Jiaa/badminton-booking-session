import { db } from "@/db";
import { sessions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SessionList } from "./session-list";

export default async function AdminSessionsPage() {
  const allSessions = await db.query.sessions.findMany({
    orderBy: [desc(sessions.startTime)],
    with: {
      attendances: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        <Link href="/admin/sessions/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
        </Link>
      </div>

      {allSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No sessions yet
          </CardContent>
        </Card>
      ) : (
        <SessionList sessions={allSessions} />
      )}
    </div>
  );
}
