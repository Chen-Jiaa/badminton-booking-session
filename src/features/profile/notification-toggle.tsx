import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      toast.success("Notifications enabled");
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
      toast.success("Notifications disabled");
    } catch {
      toast.error("Couldn't disable notifications");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          {enabled
            ? "You'll get a push notification when your top-ups and withdrawals are approved or rejected."
            : "Enable push notifications to hear about your top-ups and withdrawals."}
        </p>
        <Button
          variant={enabled ? "outline" : "default"}
          className="w-full"
          disabled={loading}
          onClick={enabled ? disable : enable}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : enabled ? (
            <BellOff className="mr-2 h-4 w-4" />
          ) : (
            <Bell className="mr-2 h-4 w-4" />
          )}
          {enabled ? "Disable notifications" : "Enable notifications"}
        </Button>
      </CardContent>
    </Card>
  );
}
