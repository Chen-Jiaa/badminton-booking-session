"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RsvpButtonsProps {
  sessionId: string;
  currentStatus?: "YES" | "NO" | "WAITLIST";
  isLoggedIn: boolean;
}

export function RsvpButtons({ sessionId, currentStatus, isLoggedIn }: RsvpButtonsProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleRsvp(status: "YES" | "NO" | "WAITLIST") {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `RSVP updated to ${status}` });
      router.refresh();
    } catch {
      toast({ title: "Failed to update RSVP", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleRsvp("YES")}
        disabled={loading}
        variant={currentStatus === "YES" ? "default" : "outline"}
        className={cn(
          "flex-1",
          currentStatus === "YES" && "bg-green-600 hover:bg-green-700"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4 mr-1" />
        )}
        Yes
      </Button>
      <Button
        onClick={() => handleRsvp("WAITLIST")}
        disabled={loading}
        variant={currentStatus === "WAITLIST" ? "default" : "outline"}
        className={cn(
          "flex-1",
          currentStatus === "WAITLIST" && "bg-yellow-600 hover:bg-yellow-700"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Clock className="h-4 w-4 mr-1" />
        )}
        Maybe
      </Button>
      <Button
        onClick={() => handleRsvp("NO")}
        disabled={loading}
        variant={currentStatus === "NO" ? "default" : "outline"}
        className={cn(
          "flex-1",
          currentStatus === "NO" && "bg-red-600 hover:bg-red-700"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4 mr-1" />
        )}
        No
      </Button>
    </div>
  );
}
