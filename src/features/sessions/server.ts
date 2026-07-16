import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { sessions, users, attendances } from "@/db/schema";
import { eq, gte, desc, and } from "drizzle-orm";
import { sessionMiddleware } from "@/middleware/auth";
import { rsvpSchema } from "@/lib/validations";

type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "FORBIDDEN" }
  | { type: "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

export const fetchSessionsFn = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    db.query.sessions.findMany({
      where: gte(sessions.startTime, now),
      orderBy: [sessions.startTime],
      with: { attendances: true, createdBy: true },
    }),
    db.query.sessions.findMany({
      where: eq(sessions.status, "LOCKED"),
      orderBy: [desc(sessions.startTime)],
      limit: 20,
      with: { attendances: true, createdBy: true },
    }),
  ]);

  return { upcoming, past };
});

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: ["sessions"],
    queryFn: () => fetchSessionsFn(),
  });

export const fetchSessionDetailFn = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    const [gameSession, appSettings] = await Promise.all([
      db.query.sessions.findFirst({
        where: eq(sessions.id, id),
        with: {
          attendances: { with: { user: true } },
          createdBy: true,
        },
      }),
      db.query.settings.findFirst(),
    ]);

    if (!gameSession) return null;

    return {
      gameSession,
      groupName: appSettings?.groupName ?? "Badminton Group",
    };
  });

export const sessionDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["sessions", id],
    queryFn: () => fetchSessionDetailFn({ data: { id } }),
  });

export const rsvpFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; status: "YES" | "NO" | "WAITLIST" }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const validated = rsvpSchema.parse(data);

    const gameSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, validated.sessionId),
    });

    if (!gameSession) return { type: "NOT_FOUND" };
    if (gameSession.status === "LOCKED") {
      return { type: "BUSINESS_ERROR", code: "Session is locked" };
    }

    if (validated.status === "YES" || validated.status === "WAITLIST") {
      const now = new Date();
      if (gameSession.rsvpDeadline && now >= gameSession.rsvpDeadline) {
        return { type: "BUSINESS_ERROR", code: "RSVP deadline has passed" };
      }
      if (now >= gameSession.startTime) {
        return {
          type: "BUSINESS_ERROR",
          code: "RSVPs are closed — the session has already started",
        };
      }
    }

    if (validated.status === "YES") {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      const balance = parseFloat(user?.balance ?? "0");
      const threshold = parseFloat(gameSession.minBalance);
      if (balance < threshold) {
        return {
          type: "BUSINESS_ERROR",
          code: `Insufficient balance. You need at least RM${threshold.toFixed(2)} to join. Current balance: RM${balance.toFixed(2)}`,
        };
      }
    }

    const existing = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.sessionId, validated.sessionId),
        eq(attendances.userId, session.user.id),
      ),
    });

    if (existing) {
      await db
        .update(attendances)
        .set({ status: validated.status, updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));
    } else {
      await db.insert(attendances).values({
        sessionId: validated.sessionId,
        userId: session.user.id,
        status: validated.status,
      });
    }

    return { type: "SUCCESS", value: undefined };
  });
