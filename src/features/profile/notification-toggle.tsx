import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import { savePushSubscriptionFn, clearPushSubscriptionFn } from "@/features/profile/server";

export function NotificationToggle({ enabled }: { enabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const queryClient = useQueryClient();

  // Push needs a service worker + PushManager; hide the control where the
  // browser can't deliver (e.g. iOS Safari before the PWA is installed).
  // Checked in an effect, not during render, so the first client render matches
  // SSR (both render nothing) and hydration doesn't mismatch — the control
  // appears once we've confirmed support on the client.
  useEffect(() => {
    setSupported(pushSupported());
  }, []);

  if (!supported) return null;

  async function enable() {
    setLoading(true);
    try {
      const subscription = await subscribeToPush();
      if (!subscription) {
        toast.error("Notifications not enabled");
        return;
      }
      await savePushSubscriptionFn({ data: { subscription } });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Notifications enabled", {
        description:
          "You'll get a push notification when your top-ups and withdrawals are approved or rejected.",
      });
    } catch {
      toast.error("Couldn't enable notifications");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      await clearPushSubscriptionFn();
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Notifications disabled", {
        description: "Turn them back on to hear about your top-ups and withdrawals.",
      });
    } catch {
      toast.error("Couldn't disable notifications");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={enabled ? "Turn off notifications" : "Turn on notifications"}
      aria-pressed={enabled}
      disabled={loading}
      onClick={enabled ? disable : enable}
      className={enabled ? "" : "text-muted-foreground"}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : enabled ? (
        <Bell className="h-5 w-5" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
    </Button>
  );
}
