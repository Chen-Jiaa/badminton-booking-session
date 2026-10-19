import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import {
  attendances,
  ledger,
  sessions,
  topUpRequests,
  users,
  withdrawalRequests,
} from "@/db/schema";
import { and, count, desc, eq, max, sum } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { requireAdmin } from "@/lib/guards";

const num = (v: string | null | undefined) => parseFloat(v ?? "0") || 0;

/** One row of the members directory — everything the list/table needs. */
export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: "PLAYER" | "HOST" | "ADMIN";
  balance: number;
  toppedUp: number;
  spent: number;
  withdrawn: number;
  adjusted: number;
  sessionsAttended: number;
  lastPlayedAt: string | null;
  joinedAt: string;
};

export const fetchMemberDirectoryFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }): Promise<MemberRow[]> => {
    if (!session?.user.id) return [];
    if (!(await requireAdmin(session.user.id))) return [];

    const [allUsers, ledgerSums, attendanceStats] = await Promise.all([
      db.query.users.findMany(),
      db
        .select({ userId: ledger.userId, type: ledger.type, total: sum(ledger.amount) })
        .from(ledger)
        .groupBy(ledger.userId, ledger.type),
      // Only YES rows count as "played" — waitlisted and declined RSVPs aren't attendance.
      db
        .select({
          userId: attendances.userId,
          played: count(),
          lastPlayed: max(sessions.startTime),
        })
        .from(attendances)
        .innerJoin(sessions, eq(attendances.sessionId, sessions.id))
        .where(eq(attendances.status, "YES"))
        .groupBy(attendances.userId),
    ]);

    const byUser = new Map<string, Map<string, number>>();
    for (const row of ledgerSums) {
      const entry = byUser.get(row.userId) ?? new Map<string, number>();
      entry.set(row.type, num(row.total));
      byUser.set(row.userId, entry);
    }

    const attendanceByUser = new Map(attendanceStats.map((r) => [r.userId, r]));

    return allUsers
      .map((u) => {
        const t = byUser.get(u.id);
        const a = attendanceByUser.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          image: u.image,
          role: u.role,
          balance: parseFloat(u.balance),
          toppedUp: t?.get("TOPUP") ?? 0,
          // debits and withdrawals are stored negative
          spent: Math.abs(t?.get("SESSION_DEBIT") ?? 0),
          withdrawn: Math.abs(t?.get("WITHDRAWAL") ?? 0),
          adjusted: t?.get("MANUAL_ADJUST") ?? 0,
          sessionsAttended: a?.played ?? 0,
          lastPlayedAt: a?.lastPlayed ? new Date(a.lastPlayed).toISOString() : null,
          joinedAt: u.createdAt.toISOString(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

export const memberDirectoryQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "member-directory"],
    queryFn: () => fetchMemberDirectoryFn(),
  });

/** A single session this member RSVP'd to, with what they were charged. */
export type MemberSession = {
  id: string;
  startTime: string;
  location: string | null;
  status: "OPEN" | "LOCKED";
  rsvp: "YES" | "NO" | "WAITLIST";
  cost: number | null;
};

export type MemberActivity = {
  id: string;
  at: string;
  type:
    | "TOPUP"
    | "SESSION_DEBIT"
    | "MANUAL_ADJUST"
    | "SESSION_DEPOSIT"
    | "SESSION_REFUND"
    | "WITHDRAWAL";
  amount: number;
  balanceAfter: number;
  note: string | null;
};

export type MemberDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: "PLAYER" | "HOST" | "ADMIN";
  balance: number;
  joinedAt: string;
  duitnowPhone: string | null;
  savedBankName: string | null;
  totals: {
    toppedUp: number;
    spent: number;
    withdrawn: number;
    adjusted: number;
  };
  stats: {
    sessionsAttended: number;
    sessionsNoShow: number;
    sessionsWaitlisted: number;
    avgCostPerSession: number;
    firstPlayedAt: string | null;
    lastPlayedAt: string | null;
  };
  pending: {
    topUps: number;
    withdrawals: number;
  };
  sessions: MemberSession[];
  activity: MemberActivity[];
};

export const fetchMemberDetailFn = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<MemberDetail | null> => {
    if (!session?.user.id) return null;
    if (!(await requireAdmin(session.user.id))) return null;

    const member = await db.query.users.findFirst({ where: eq(users.id, data.userId) });
    if (!member) return null;

    const [ledgerRows, attendanceRows, ledgerSums, pendingTopUps, pendingWithdrawals] =
      await Promise.all([
        db.query.ledger.findMany({
          where: eq(ledger.userId, member.id),
          orderBy: [desc(ledger.createdAt)],
          limit: 100,
        }),
        db
          .select({
            id: sessions.id,
            startTime: sessions.startTime,
            location: sessions.location,
            status: sessions.status,
            rsvp: attendances.status,
            finalCost: attendances.finalCost,
          })
          .from(attendances)
          .innerJoin(sessions, eq(attendances.sessionId, sessions.id))
          .where(eq(attendances.userId, member.id))
          .orderBy(desc(sessions.startTime)),
        db
          .select({ type: ledger.type, total: sum(ledger.amount) })
          .from(ledger)
          .where(eq(ledger.userId, member.id))
          .groupBy(ledger.type),
        db
          .select({ n: count() })
          .from(topUpRequests)
          .where(
            and(
              eq(topUpRequests.userId, member.id),
              eq(topUpRequests.status, "PENDING"),
              eq(topUpRequests.isDeleted, false),
            ),
          ),
        db
          .select({ n: count() })
          .from(withdrawalRequests)
          .where(
            and(eq(withdrawalRequests.userId, member.id), eq(withdrawalRequests.status, "PENDING")),
          ),
      ]);

    const totalsByType = new Map(ledgerSums.map((r) => [r.type, num(r.total)]));
    const spent = Math.abs(totalsByType.get("SESSION_DEBIT") ?? 0);

    const played = attendanceRows.filter((r) => r.rsvp === "YES");
    const attendedLocked = played.filter((r) => r.status === "LOCKED");

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      image: member.image,
      role: member.role,
      balance: parseFloat(member.balance),
      joinedAt: member.createdAt.toISOString(),
      duitnowPhone: member.duitnowPhone,
      savedBankName: member.savedBankName,
      totals: {
        toppedUp: totalsByType.get("TOPUP") ?? 0,
        spent,
        withdrawn: Math.abs(totalsByType.get("WITHDRAWAL") ?? 0),
        adjusted: totalsByType.get("MANUAL_ADJUST") ?? 0,
      },
      stats: {
        sessionsAttended: played.length,
        sessionsNoShow: attendanceRows.filter((r) => r.rsvp === "NO").length,
        sessionsWaitlisted: attendanceRows.filter((r) => r.rsvp === "WAITLIST").length,
        // Only settled sessions have a real per-player cost, so average over those.
        avgCostPerSession: attendedLocked.length > 0 ? spent / attendedLocked.length : 0,
        firstPlayedAt: played.at(-1)?.startTime.toISOString() ?? null,
        lastPlayedAt: played.at(0)?.startTime.toISOString() ?? null,
      },
      pending: {
        topUps: pendingTopUps[0]?.n ?? 0,
        withdrawals: pendingWithdrawals[0]?.n ?? 0,
      },
      sessions: attendanceRows.map((r) => ({
        id: r.id,
        startTime: r.startTime.toISOString(),
        location: r.location,
        status: r.status,
        rsvp: r.rsvp,
        cost: r.finalCost === null ? null : parseFloat(r.finalCost),
      })),
      activity: ledgerRows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        type: r.type,
        amount: parseFloat(r.amount),
        balanceAfter: parseFloat(r.balanceAfter),
        note: r.note,
      })),
    };
  });

export const memberDetailQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "member-detail", userId],
    queryFn: () => fetchMemberDetailFn({ data: { userId } }),
  });
