// Client-side Web Push subscription. Registration of the service worker itself
// is handled by vite-plugin-pwa (injectRegister: "auto"); here we just grab the
// ready registration and subscribe its PushManager.

/** VAPID keys are base64url; PushManager needs the raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Prompts for notification permission and subscribes to Web Push. Returns the
 * subscription as a JSON string (to store in users.fcmToken), or null if the
 * user declined or push isn't supported.
 */
export async function subscribeToPush(): Promise<string | null> {
  if (!pushSupported()) return null;

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    console.error("VITE_VAPID_PUBLIC_KEY is not set");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription if the browser already has one; otherwise
    // create a fresh one bound to our VAPID key.
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }));

    return JSON.stringify(subscription);
  } catch (error) {
    console.error("Failed to subscribe to push:", error);
    return null;
  }
}

/** Removes the browser's push subscription (best-effort). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch (error) {
    console.error("Failed to unsubscribe from push:", error);
  }
}
