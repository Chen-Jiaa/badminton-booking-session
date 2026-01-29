import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && (!user || user.role === "PLAYER")) {
    redirect("/");
  }

  return <>{children}</>;
}
