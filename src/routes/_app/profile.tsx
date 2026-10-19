import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { profileQueryOptions } from "@/features/profile/server";
import { financeSummaryQueryOptions } from "@/features/finance/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { NotificationToggle } from "@/features/profile/notification-toggle";
import { PhoneForm } from "@/features/profile/phone-form";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CalendarDays, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(profileQueryOptions()),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useSuspenseQueryDeferred(profileQueryOptions());
  const { pendingTopupsCount, pendingWithdrawalsCount } = Route.useRouteContext().user!;
  const pendingCount = pendingTopupsCount + pendingWithdrawalsCount;
  const isAdmin = user.role === "ADMIN";
  const { data: finance } = useQuery({ ...financeSummaryQueryOptions(), enabled: isAdmin });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="text-lg bg-brand text-brand-foreground">
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

      {isAdmin && finance && (
        <Link to="/admin/finance" className="block">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {finance.trueSurplus < 0 ? "Shortfall" : "Surplus"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p
                className={`text-3xl font-bold ${finance.trueSurplus < 0 ? "text-danger" : "text-success"}`}
              >
                {formatCurrency(finance.trueSurplus)}
              </p>
              <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                <div className="flex justify-between">
                  <span>Club cash</span>
                  <span className="font-medium">{formatCurrency(finance.clubCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Owed to members</span>
                  <span className="text-danger font-medium">
                    −{formatCurrency(finance.memberLiability)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unpaid / unreimbursed</span>
                  <span className="text-danger font-medium">
                    −{formatCurrency(finance.owedToAccountant + finance.unpaidExpenses)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {(user.role === "HOST" || isAdmin) && <PhoneForm phone={user.phone} />}

      <NotificationToggle enabled={!!user.fcmToken} />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Panel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/topups" className="relative">
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                )}
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <CreditCard className="h-6 w-6 text-brand-foreground" />
                  <span className="text-sm font-medium text-center">Pending Top-Ups</span>
                </div>
              </Link>

              <Link to="/admin/sessions">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <CalendarDays className="h-6 w-6 text-brand-foreground" />
                  <span className="text-sm font-medium text-center">Manage Sessions</span>
                </div>
              </Link>

              <Link to="/admin/members">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <Users className="h-6 w-6 text-brand-foreground" />
                  <span className="text-sm font-medium text-center">Members</span>
                </div>
              </Link>

              <Link to="/admin/finance">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <Wallet className="h-6 w-6 text-brand-foreground" />
                  <span className="text-sm font-medium text-center">Finance</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <SignOutButton />
    </div>
  );
}
