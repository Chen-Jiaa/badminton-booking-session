import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { signOutFn } from "@/features/auth/server";

export function SignOutButton() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOutFn();
    navigate({ to: "/login" });
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  );
}
