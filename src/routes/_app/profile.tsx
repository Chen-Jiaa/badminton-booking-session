import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { profileQueryOptions } from "@/features/profile/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { CreditCard, CalendarDays, Users, Download } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(profileQueryOptions()),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useSuspenseQueryDeferred(profileQueryOptions());
  const { pendingTopupsCount } = Route.useRouteContext().user!;
  const isAdmin = user.role === "HOST";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="text-lg bg-green-100 text-green-700">
                {user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1">
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-3xl font-bold ${parseFloat(user.balance) < 0 ? "text-red-600" : "text-green-600"}`}
          >
            {formatCurrency(user.balance)}
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Panel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/topups" className="relative">
                {pendingTopupsCount > 0 && (
                  <span className="absolute -top-2 -right-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                    {pendingTopupsCount}
                  </span>
                )}
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <CreditCard className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium text-center">Pending Top-Ups</span>
                </div>
              </Link>

              <Link to="/admin/sessions">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <CalendarDays className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium text-center">Manage Sessions</span>
                </div>
              </Link>

              <Link to="/admin/members">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <Users className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium text-center">Members</span>
                </div>
              </Link>

              <div className="flex flex-col items-center gap-2 rounded-lg border p-4 opacity-50 cursor-not-allowed">
                <Download className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-center">Export CSV</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SignOutButton />
    </div>
  );
}
