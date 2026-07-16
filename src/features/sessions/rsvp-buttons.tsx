import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { LoginDialog } from "@/features/sessions/login-dialog";
import { rsvpFn } from "@/features/sessions/server";

interface RsvpButtonsProps {
  sessionId: string;
  currentStatus?: "YES" | "NO" | "WAITLIST";
  isLoggedIn: boolean;
  isFull?: boolean;
}

export function RsvpButtons({ sessionId, currentStatus, isLoggedIn, isFull }: RsvpButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleRsvp(status: "YES" | "NO") {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }

    setLoading(true);
    try {
      const result = await rsvpFn({ data: { sessionId, status } });
      if (result.type === "AUTH_ERROR") {
        toast({ title: "Please sign in to RSVP", variant: "destructive" });
        setShowLogin(true);
        return;
      }
      if (result.type !== "SUCCESS") {
        toast({
          title: result.type === "BUSINESS_ERROR" ? result.code : "Failed to update RSVP",
          variant: "destructive",
        });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      toast({ title: "Failed to update RSVP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const isJoined = currentStatus === "YES";

  return (
    <>
      {isJoined ? (
        <Button
          onClick={() => handleRsvp("NO")}
          disabled={loading}
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave Game"}
        </Button>
      ) : (
        <Button
          onClick={() => handleRsvp("YES")}
          disabled={loading || isFull}
          className={
            isFull
              ? "w-full bg-gray-100 text-gray-400 cursor-not-allowed"
              : "w-full bg-green-600 hover:bg-green-700 text-white"
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Game"}
        </Button>
      )}
      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </>
  );
}
