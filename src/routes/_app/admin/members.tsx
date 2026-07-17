import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { membersQueryOptions } from "@/features/admin/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/members")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(membersQueryOptions()),
  component: AdminMembersPage,
});

function AdminMembersPage() {
  const { data: allUsers } = useSuspenseQueryDeferred(membersQueryOptions());

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Members ({allUsers.length})</h1>

      <div className="space-y-2">
        {allUsers.map((user) => {
          const balance = parseFloat(user.balance);
          const isNegative = balance < 0;
          const isLow = balance < 20 && balance >= 0;

          return (
            <Card key={user.id}>
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="bg-brand text-brand-foreground">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{user.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${isNegative ? "text-red-600" : isLow ? "text-yellow-600" : "text-green-600"}`}
                    >
                      {formatCurrency(balance)}
                    </p>
                    {isNegative && (
                      <Badge variant="destructive" className="text-xs">
                        Owes
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
