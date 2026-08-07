import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "@/db";
import { expenses, ledger, users, withdrawalRequests } from "@/db/schema";
import { and, asc, gte, lte } from "drizzle-orm";
import { verifyAccessToken } from "@/middleware/auth";
import { requireAdmin } from "@/lib/guards";
import { toCsv, csvResponse } from "@/lib/csv";
import { fmtDate, expenseStatus } from "@/features/finance/format";

const DATASETS = ["ledger", "expenses", "withdrawals", "members"] as const;
type Dataset = (typeof DATASETS)[number];

// Server route rather than a server function: a file download needs real
// Content-Type / Content-Disposition headers and a plain <a href> to trigger it.
export const Route = createFileRoute("/api/admin/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await verifyAccessToken(getCookie("sb-access-token"));
        if (!session?.user.id) return new Response("Unauthorized", { status: 401 });
        if (!(await requireAdmin(session.user.id))) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const dataset = url.searchParams.get("dataset") as Dataset | null;
        if (!dataset || !DATASETS.includes(dataset)) {
          return new Response(`dataset must be one of: ${DATASETS.join(", ")}`, { status: 400 });
        }

        const fromParam = url.searchParams.get("from");
        const toParam = url.searchParams.get("to");
        const from = fromParam ? new Date(fromParam) : null;
        const to = toParam ? new Date(toParam) : null;
        if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
          return new Response("Invalid date range", { status: 400 });
        }

        const range = (col: Parameters<typeof gte>[0]) => {
          const parts = [];
          if (from) parts.push(gte(col, from));
          if (to) parts.push(lte(col, to));
          return parts.length ? and(...parts) : undefined;
        };

        let body: string;

        switch (dataset) {
          case "ledger": {
            const rows = await db.query.ledger.findMany({
              where: range(ledger.createdAt),
              orderBy: [asc(ledger.createdAt)],
              with: { user: true, session: true },
            });
            body = toCsv(
              ["Date", "Member", "Type", "Amount", "Balance After", "Session", "Note"],
              rows.map((r) => [
                fmtDate(r.createdAt),
                r.user.name,
                r.type,
                r.amount,
                r.balanceAfter,
                r.session ? fmtDate(r.session.startTime) : "",
                r.note ?? "",
              ]),
            );
            break;
          }

          case "expenses": {
            const rows = await db.query.expenses.findMany({
              where: range(expenses.createdAt),
              orderBy: [asc(expenses.createdAt)],
              with: { session: true, paidBy: true },
            });
            body = toCsv(
              [
                "Recorded",
                "Category",
                "Amount",
                "Status",
                "Paid On",
                "Paid By",
                "Reimbursed On",
                "Session",
                "Note",
                "Deleted",
              ],
              rows.map((r) => [
                fmtDate(r.createdAt),
                r.category,
                r.amount,
                expenseStatus(r),
                r.paidAt ? fmtDate(r.paidAt) : "",
                r.paidBy?.name ?? "",
                r.reimbursedAt ? fmtDate(r.reimbursedAt) : "",
                r.session ? fmtDate(r.session.startTime) : "",
                r.note ?? "",
                r.isDeleted ? "YES" : "",
              ]),
            );
            break;
          }

          case "withdrawals": {
            const rows = await db.query.withdrawalRequests.findMany({
              where: range(withdrawalRequests.createdAt),
              orderBy: [asc(withdrawalRequests.createdAt)],
              with: { user: true },
            });
            body = toCsv(
              [
                "Requested",
                "Member",
                "Amount",
                "Status",
                "Method",
                "Bank",
                "Account",
                "DuitNow",
                "Resolved",
                "Reject Reason",
                "Note",
              ],
              rows.map((r) => [
                fmtDate(r.createdAt),
                r.user.name,
                r.amount,
                r.status,
                r.paymentMethod ?? "",
                r.bankName ?? "",
                r.accountNumber ?? "",
                r.duitnowPhone ?? "",
                r.resolvedAt ? fmtDate(r.resolvedAt) : "",
                r.rejectReason ?? "",
                r.note ?? "",
              ]),
            );
            break;
          }

          case "members": {
            // Point-in-time balances — the date range doesn't apply.
            const rows = await db.query.users.findMany({ orderBy: [asc(users.name)] });
            body = toCsv(
              ["Name", "Email", "Phone", "Role", "Balance", "Joined"],
              rows.map((r) => [
                r.name,
                r.email ?? "",
                r.phone ?? "",
                r.role,
                r.balance,
                fmtDate(r.createdAt),
              ]),
            );
            break;
          }
        }

        const stamp = [fromParam ?? "all", toParam ?? "now"].join("_to_");
        return csvResponse(`${dataset}-${stamp}.csv`, body);
      },
    },
  },
});
