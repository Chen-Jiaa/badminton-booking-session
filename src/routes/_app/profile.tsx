import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { profileQueryOptions } from "@/features/profile/server";
import { financeSummaryQueryOptions } from "@/features/finance/server";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { NotificationToggle } from "@/features/profile/notification-toggle";
import { StreakCard } from "@/features/profile/streak-card";
import { PhoneForm } from "@/features/profile/phone-form";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(profileQueryOptions()),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user } = useSuspenseQueryDeferred(profileQueryOptions());
  const { pendingTopupsCount, pendingWithdrawalsCount, pendingLateCancelsCount } =
    Route.useRouteContext().user!;
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

      <StreakCard />

      {isAdmin && (
        <Card className="overflow-hidden py-0 gap-0">
          {finance && (
            <Link
              to="/admin/finance"
              className="block px-6 py-4 transition-colors [@media(hover:hover)]:hover:bg-muted/50"
            >
              <p className="text-sm text-muted-foreground">
                {finance.trueSurplus < 0 ? "Shortfall" : "Surplus"}
              </p>
              <p
                className={`text-3xl font-bold ${finance.trueSurplus < 0 ? "text-danger" : "text-success"}`}
              >
                {formatCurrency(finance.trueSurplus)}
              </p>
            </Link>
          )}
          {pendingCount > 0 && (
            <AdminRow
              to="/admin/topups"
              label={`${pendingCount} transaction${pendingCount > 1 ? "s" : ""} to review`}
              dot
            />
          )}
          {pendingLateCancelsCount > 0 && (
            <AdminRow
              to="/admin/sessions"
              label={`${pendingLateCancelsCount} late cancel${pendingLateCancelsCount > 1 ? "s" : ""} to approve`}
              dot
            />
          )}
          <AdminRow to="/admin/topups" label="Open console" />
        </Card>
      )}

      {(user.role === "HOST" || isAdmin) && <PhoneForm phone={user.phone} />}

      <NotificationToggle enabled={!!user.fcmToken} />

      <SignOutButton />
    </div>
  );
}

function AdminRow({ to, label, dot }: { to: string; label: string; dot?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-t px-6 py-3.5 text-sm font-medium transition-[background-color,transform] active:scale-[0.98] motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-muted/50"
    >
      {dot && <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />}
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
