"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/supabase-client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={() => signOut()}>
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  );
}
