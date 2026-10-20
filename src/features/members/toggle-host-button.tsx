import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setMemberRoleFn } from "@/features/members/server";

/** Promotes a player to host (can run their own sessions) or demotes a host back to player, after confirming. */
export function ToggleHostButton({
  userId,
  memberName,
  isHost,
}: {
  userId: string;
  memberName: string;
  isHost: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  async function confirm() {
    setLoading(true);
    try {
      const result = await setMemberRoleFn({ data: { userId, role: isHost ? "PLAYER" : "HOST" } });
      if (result.type !== "SUCCESS") {
        toast.error(result.type === "BUSINESS_ERROR" ? result.code : "Something went wrong");
        return;
      }
      toast.success(isHost ? `${memberName} is no longer a host` : `${memberName} is now a host`);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "member-detail", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "member-directory"] }),
      ]);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {isHost ? "Remove host" : "Make host"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isHost ? `Remove ${memberName} as host?` : `Make ${memberName} a host?`}
          </DialogTitle>
          <DialogDescription>
            {isHost
              ? "They'll go back to being a regular player and can no longer run sessions."
              : "Hosts can create and run their own sessions."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isHost ? (
              "Remove host"
            ) : (
              "Make host"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
