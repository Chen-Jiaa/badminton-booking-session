import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOutFn } from "@/features/auth/server";

export function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await signOutFn();
    queryClient.removeQueries({ queryKey: ["current-user"] });
    navigate({ to: "/login" });
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={handleSignOut}>
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  );
}
