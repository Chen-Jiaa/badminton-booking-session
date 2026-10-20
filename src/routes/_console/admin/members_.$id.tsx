import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Mail, Phone } from "lucide-react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { memberDetailQueryOptions, type MemberDetail } from "@/features/members/server";
import { AdjustBalanceDialog } from "@/features/members/adjust-balance-dialog";
import { ToggleHostButton } from "@/features/members/toggle-host-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export const Route = createFileRoute("/_console/admin/members_/$id")({
  loader: async ({ context: { queryClient }, params }) => {
    const member = await queryClient.ensureQueryData(memberDetailQueryOptions(params.id));
    if (!member) throw notFound();
    return member;
  },
  component: MemberDetailPage,
});

const ACTIVITY_LABELS: Record<MemberDetail["activity"][number]["type"], string> = {
  TOPUP: "Top-up",
  SESSION_DEBIT: "Session charge",
  SESSION_DEPOSIT: "Session deposit",
  SESSION_REFUND: "Session refund",
  MANUAL_ADJUST: "Manual adjustment",
  WITHDRAWAL: "Withdrawal",
};

function MemberDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQueryDeferred(memberDetailQueryOptions(id));
  // The loader throws notFound() for a missing member, so by render time this
  // is always populated.
  const member = data!;

  const { stats, totals } = member;

  return (
    <div className="space-y-5">
      <Link
        to="/admin/members"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All members
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <Avatar className="h-14 w-14">
            <AvatarImage src={member.image || undefined} />
            <AvatarFallback className="bg-brand text-lg text-brand-foreground">
              {member.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold">{member.name}</h1>
              <Badge variant="outline">{member.role}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {member.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {member.email}
                </span>
              )}
              {member.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {member.phone}
                </span>
              )}
              <span>Joined {formatDate(member.joinedAt)}</span>
            </div>
            {(member.pending.topUps > 0 || member.pending.withdrawals > 0) && (
              <div className="mt-2 flex gap-2">
                {member.pending.topUps > 0 && (
                  <Link to="/admin/topups">
                    <Badge variant="secondary">
                      {member.pending.topUps} top-up{member.pending.topUps > 1 ? "s" : ""} pending
                    </Badge>
                  </Link>
                )}
                {member.pending.withdrawals > 0 && (
                  <Badge variant="secondary">
                    {member.pending.withdrawals} payout
                    {member.pending.withdrawals > 1 ? "s" : ""} pending
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  member.balance < 0
                    ? "text-danger"
                    : member.balance < 20
                      ? "text-warning"
                      : "text-success",
                )}
              >
                {formatCurrency(member.balance)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <AdjustBalanceDialog
                userId={member.id}
                memberName={member.name}
                balance={member.balance}
              />
              {member.role !== "ADMIN" && (
                <ToggleHostButton
                  userId={member.id}
                  memberName={member.name}
                  isHost={member.role === "HOST"}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions played" value={String(stats.sessionsAttended)} />
        <Stat label="Total spent" value={formatCurrency(totals.spent)} />
        <Stat label="Avg per session" value={formatCurrency(stats.avgCostPerSession)} />
        <Stat label="Total topped up" value={formatCurrency(totals.toppedUp)} />
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="w-full lg:inline-flex lg:w-auto">
          <TabsTrigger value="sessions" className="flex-1 lg:flex-none lg:px-6">
            Sessions ({member.sessions.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 lg:flex-none lg:px-6">
            Wallet activity
          </TabsTrigger>
          <TabsTrigger value="details" className="flex-1 lg:flex-none lg:px-6">
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <SessionsTab member={member} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab member={member} />
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <DetailsTab member={member} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function SessionsTab({ member }: { member: MemberDetail }) {
  if (member.sessions.length === 0) return <Empty>Hasn&rsquo;t joined a session yet</Empty>;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Where</TableHead>
            <TableHead>RSVP</TableHead>
            <TableHead className="text-right">Charged</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {member.sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link
                  to="/admin/sessions/$id"
                  params={{ id: s.id }}
                  className="font-medium hover:underline"
                >
                  {formatDate(s.startTime)}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{s.location ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    s.rsvp === "YES" ? "success" : s.rsvp === "WAITLIST" ? "secondary" : "outline"
                  }
                >
                  {s.rsvp === "YES" ? "Played" : s.rsvp === "WAITLIST" ? "Waitlist" : "Declined"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {s.cost === null ? (
                  <span className="text-xs text-muted-foreground">
                    {s.status === "OPEN" ? "Not settled" : "—"}
                  </span>
                ) : (
                  formatCurrency(s.cost)
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ActivityTab({ member }: { member: MemberDetail }) {
  if (member.activity.length === 0) return <Empty>No wallet activity yet</Empty>;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Note</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance after</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {member.activity.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(a.at)}
              </TableCell>
              <TableCell>{ACTIVITY_LABELS[a.type]}</TableCell>
              <TableCell className="text-muted-foreground">{a.note ?? "—"}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium",
                  a.amount < 0 ? "text-danger" : "text-success",
                )}
              >
                {a.amount < 0 ? "−" : "+"}
                {formatCurrency(Math.abs(a.amount))}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(a.balanceAfter)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function DetailsTab({ member }: { member: MemberDetail }) {
  const { stats, totals } = member;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Money</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row label="Topped up" value={formatCurrency(totals.toppedUp)} />
          <Row label="Spent on sessions" value={formatCurrency(totals.spent)} />
          <Row label="Withdrawn" value={formatCurrency(totals.withdrawn)} />
          <Row label="Manual adjustments" value={formatCurrency(totals.adjusted)} />
          <Row label="Current balance" value={formatCurrency(member.balance)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row label="Sessions played" value={String(stats.sessionsAttended)} />
          <Row label="Declined" value={String(stats.sessionsNoShow)} />
          <Row label="Waitlisted" value={String(stats.sessionsWaitlisted)} />
          <Row
            label="First played"
            value={stats.firstPlayedAt ? formatDate(stats.firstPlayedAt) : "—"}
          />
          <Row
            label="Last played"
            value={stats.lastPlayedAt ? formatDate(stats.lastPlayedAt) : "—"}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Payout details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row label="DuitNow phone" value={member.duitnowPhone ?? "Not set"} />
          <Row label="Bank" value={member.savedBankName ?? "Not set"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
