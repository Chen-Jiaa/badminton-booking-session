import { auth } from "@/lib/supabase-server";
import { BottomNav } from "@/components/bottom-nav";
import { Header } from "@/components/header";
import { db } from "@/db";
import { users, topUpRequests } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let userRole: "PLAYER" | "HOST" = "PLAYER";
  let pendingTopupsCount = 0;

  if (session?.user?.id) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true },
    });
    if (dbUser?.role) {
      userRole = dbUser.role;
    }
    if (userRole === "HOST") {
      const [result] = await db
        .select({ count: count() })
        .from(topUpRequests)
        .where(eq(topUpRequests.status, "PENDING"));
      pendingTopupsCount = result?.count ?? 0;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header user={session?.user} />
      <main className="container mx-auto px-4 py-6 max-w-lg">{children}</main>
      <BottomNav userRole={userRole} pendingTopupsCount={pendingTopupsCount} />
    </div>
  );
}
