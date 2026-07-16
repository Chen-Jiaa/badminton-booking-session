import { Card, CardContent } from "@/components/ui/card";
import { SessionForm } from "../session-form";

export default function NewSessionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Create Session</h1>
      <Card>
        <CardContent className="pt-6">
          <SessionForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
