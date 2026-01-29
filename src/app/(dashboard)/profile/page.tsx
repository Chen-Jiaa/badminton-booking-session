import { auth } from "@/lib/supabase-server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;

  const isAdmin = user.role === "HOST" || user.role === "TREASURER";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="text-lg bg-green-100 text-green-700">
                {user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1">{user.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${parseFloat(user.balance) < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(user.balance)}
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/topups">
              <button className="w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50">
                Pending Top-Ups
              </button>
            </Link>
            <Link href="/admin/sessions">
              <button className="w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50">
                Manage Sessions
              </button>
            </Link>
            <Link href="/admin/members">
              <button className="w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50">
                Members
              </button>
            </Link>
            {user.role === "TREASURER" && (
              <Link href="/admin/export">
                <button className="w-full text-left px-4 py-2 border rounded-md hover:bg-gray-50">
                  Export CSV
                </button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <SignOutButton />
    </div>
  );
}
