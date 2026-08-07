import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { memberDirectoryQueryOptions, type MemberRow } from "@/features/members/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_console/admin/members")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(memberDirectoryQueryOptions()),
  component: MembersPage,
});

type SortKey = "name" | "balance" | "spent" | "toppedUp" | "sessionsAttended" | "lastPlayedAt";

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Member" },
  { key: "sessionsAttended", label: "Sessions", numeric: true },
  { key: "toppedUp", label: "Topped up", numeric: true },
  { key: "spent", label: "Spent", numeric: true },
  { key: "lastPlayedAt", label: "Last played" },
  { key: "balance", label: "Balance", numeric: true },
];

function MembersPage() {
  const { data: members } = useSuspenseQueryDeferred(memberDirectoryQueryOptions());
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "name",
    desc: false,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? members.filter((m) =>
          [m.name, m.email, m.phone].some((v) => v?.toLowerCase().includes(q)),
        )
      : members;

    return [...filtered].sort((a, b) => {
      const cmp = compare(a, b, sort.key);
      return sort.desc ? -cmp : cmp;
    });
  }, [members, search, sort]);

  const owing = members.filter((m) => m.balance < 0);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold lg:text-2xl">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} total
            {owing.length > 0 && (
              <>
                {" · "}
                <span className="text-red-600">{owing.length} with a negative balance</span>
              </>
            )}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone"
            className="pl-9"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No members match “{search}”
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: dense table. Phone: tappable cards. */}
          <Card className="hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn("cursor-pointer select-none", col.numeric && "text-right")}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          sort.key === col.key && "text-foreground",
                        )}
                      >
                        {col.label}
                        {sort.key === col.key &&
                          (sort.desc ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          ))}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to="/admin/members/$id"
                        params={{ id: m.id }}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.image || undefined} />
                          <AvatarFallback className="bg-brand text-xs text-brand-foreground">
                            {m.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{m.name}</span>
                            {m.role !== "PLAYER" && (
                              <Badge variant="outline" className="text-[10px]">
                                {m.role}
                              </Badge>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.email ?? m.phone ?? "—"}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{m.sessionsAttended}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.toppedUp)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.spent)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.lastPlayedAt ? formatDate(m.lastPlayedAt) : "Never"}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", balanceClass(m.balance))}>
                      {formatCurrency(m.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="space-y-2 lg:hidden">
            {rows.map((m) => (
              <Link key={m.id} to="/admin/members/$id" params={{ id: m.id }} className="block">
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={m.image || undefined} />
                        <AvatarFallback className="bg-brand text-brand-foreground">
                          {m.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{m.name}</p>
                          {m.role !== "PLAYER" && (
                            <Badge variant="outline" className="text-[10px]">
                              {m.role}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.sessionsAttended} sessions · spent {formatCurrency(m.spent)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-semibold", balanceClass(m.balance))}>
                          {formatCurrency(m.balance)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function balanceClass(balance: number) {
  if (balance < 0) return "text-red-600";
  if (balance < 20) return "text-yellow-600";
  return "";
}

function compare(a: MemberRow, b: MemberRow, key: SortKey) {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "lastPlayedAt") {
    // never-played sorts last in both directions would be nicer, but keeping it
    // simple: empty string sorts before any ISO date.
    return (a.lastPlayedAt ?? "").localeCompare(b.lastPlayedAt ?? "");
  }
  return a[key] - b[key];
}
