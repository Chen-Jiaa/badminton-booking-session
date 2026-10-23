import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQueryDeferred } from "@/hooks/use-suspense-query-deferred";
import { leaderboardQueryOptions } from "@/features/matches/server";
import { Leaderboard } from "@/features/matches/leaderboard";
import { PendingMatchesBanner } from "@/features/matches/pending-banner";
import { isMonthKey, monthKeyOf, shiftMonth } from "@/features/matches/logic";

export const Route = createFileRoute("/_app/leaderboard")({
  validateSearch: (search: Record<string, unknown>): { month?: string } =>
    typeof search.month === "string" && isMonthKey(search.month) ? { month: search.month } : {},
  loaderDeps: ({ search }) => ({ month: search.month ?? monthKeyOf(new Date()) }),
  loader: ({ context: { queryClient }, deps: { month } }) =>
    queryClient.ensureQueryData(leaderboardQueryOptions(month)),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { month = monthKeyOf(new Date()) } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQueryDeferred(leaderboardQueryOptions(month));
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <div className="space-y-4">
      <PendingMatchesBanner
        sessionId={user?.pendingMatchSessionId}
        count={user?.pendingMatchesCount}
      />
      <Leaderboard
        data={data}
        meId={user?.id}
        onMonthChange={(delta) =>
          navigate({ search: { month: shiftMonth(data.month, delta) }, replace: true })
        }
      />
    </div>
  );
}
