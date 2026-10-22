import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { db } from "@/db";
import { attendances, sessions, users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { dayKeyOf } from "./streak";
import { sessionMiddleware } from "@/middleware/auth";
import { updatePhoneSchema } from "@/lib/validations";
import { toWhatsAppNumber } from "@/lib/phone";
import type { Result } from "@/lib/guards";

export const fetchProfileFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return null;

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user) return null;

    return user;
  });

export const profileQueryOptions = () =>
  queryOptions({
    queryKey: ["profile"],
    queryFn: () => fetchProfileFn(),
    staleTime: 5 * 60 * 1000, // profile data changes rarely and only through explicit actions
  });

/**
 * Club-local days (Malaysia time) on which the signed-in player actually played:
 * confirmed (YES) on a session that has been finalized. Late cancels that were approved
 * are NO, so they don't count; a rejected one stays YES and is charged, so it does.
 */
export const fetchPlayedDaysFn = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return [];

    const rows = await db
      .select({ startTime: sessions.startTime })
      .from(attendances)
      .innerJoin(sessions, eq(sessions.id, attendances.sessionId))
      .where(
        and(
          eq(attendances.userId, session.user.id),
          eq(attendances.status, "YES"),
          eq(sessions.status, "LOCKED"),
        ),
      );

    return Array.from(new Set(rows.map((r) => dayKeyOf(r.startTime))));
  });

export const playedDaysQueryOptions = () =>
  queryOptions({
    queryKey: ["profile", "played-days"],
    queryFn: () => fetchPlayedDaysFn(),
    staleTime: 60 * 1000,
  });

/**
 * Stores the browser's Web Push subscription (JSON) so the server can send this
 * user notifications. The column is named fcm_token for legacy reasons; it now
 * holds a PushSubscription, not an FCM token.
 */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: { subscription: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }) => {
    if (!session?.user.id) return { ok: false };

    await db
      .update(users)
      .set({ fcmToken: data.subscription })
      .where(eq(users.id, session.user.id));

    return { ok: true };
  });

export const clearPushSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([sessionMiddleware])
  .handler(async ({ context: { session } }) => {
    if (!session?.user.id) return { ok: false };

    await db.update(users).set({ fcmToken: null }).where(eq(users.id, session.user.id));

    return { ok: true };
  });

/** Hosts' WhatsApp number, shown to members on their sessions. Stored as +60…. */
export const updatePhoneFn = createServerFn({ method: "POST" })
  .validator((data: { phone: string }) => data)
  .middleware([sessionMiddleware])
  .handler(async ({ data, context: { session } }): Promise<Result<{ phone: string | null }>> => {
    if (!session?.user.id) return { type: "AUTH_ERROR" };

    const parsed = updatePhoneSchema.safeParse(data);
    if (!parsed.success) return { type: "BUSINESS_ERROR", code: "Enter a valid phone number" };

    const number = parsed.data.phone ? toWhatsAppNumber(parsed.data.phone) : null;
    const phone = number ? `+${number}` : null;

    if (phone) {
      const taken = await db.query.users.findFirst({
        where: and(eq(users.phone, phone), ne(users.id, session.user.id)),
        columns: { id: true },
      });
      if (taken) return { type: "BUSINESS_ERROR", code: "That number belongs to another member" };
    }

    await db
      .update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    return { type: "SUCCESS", value: { phone } };
  });
