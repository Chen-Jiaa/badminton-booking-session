import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export type Result<T = void> =
  | { type: "SUCCESS"; value: T }
  | { type: "AUTH_ERROR" }
  | { type: "FORBIDDEN" }
  | { type: "NOT_FOUND" }
  | { type: "BUSINESS_ERROR"; code: string };

/**
 * Loads the acting user and asserts the ADMIN role.
 * Returns null when the user is missing or not an admin — callers return
 * FORBIDDEN (mutations) or an empty result (queries).
 */
export async function requireAdmin(userId: string): Promise<User | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

/**
 * Web Push subscriptions of every admin who has push enabled (stored only after
 * notifications are granted in the browser). Used to alert admins of incoming
 * top-up / withdrawal requests. The column is named fcm_token for legacy reasons
 * but now holds a PushSubscription JSON string.
 */
export async function getAdminFcmTokens(): Promise<string[]> {
  const admins = await db.query.users.findMany({
    where: and(eq(users.role, "ADMIN"), isNotNull(users.fcmToken)),
    columns: { fcmToken: true },
  });
  return admins.map((a) => a.fcmToken).filter((t): t is string => t !== null);
}
