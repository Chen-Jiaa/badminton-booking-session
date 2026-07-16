"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { LoginDialog } from "./login-dialog";

interface RsvpButtonsProps {
  sessionId: string;
  currentStatus?: "YES" | "NO" | "WAITLIST";
  isLoggedIn: boolean;
  isFull?: boolean;
}

export function RsvpButtons({
  sessionId,
  currentStatus,
  isLoggedIn,
  isFull,
}: RsvpButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleRsvp(status: "YES" | "NO") {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to update RSVP", variant: "destructive" });
        return;
      }
      router.refresh();
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
