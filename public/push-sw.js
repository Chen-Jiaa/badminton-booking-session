// The app's service worker. Served verbatim from `public/` at `/push-sw.js` and
// registered by `src/client.tsx`. We hand-roll this instead of using
// vite-plugin-pwa's generateSW: under TanStack Start + Nitro the client output
// moves to `.output/public`, but the plugin writes its `sw.js` to `dist/`, so the
// generated worker never ships and `/sw.js` 404s in production.
//
// Two responsibilities: Web Push handling and cache-first caching of Google
// avatars. The server sends a JSON push payload of { title, body, data }.

const AVATAR_CACHE = "google-avatars";
const AVATAR_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day

// Activate immediately rather than waiting for all tabs to close, so a freshly
// registered worker starts controlling the page (and `serviceWorker.ready`
// resolves) on first load — the push subscription flow depends on this.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Notification", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Notification";
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = (event.notification.data && event.notification.data.link) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab if one is already open, otherwise open a new one.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});

// Cache-first for Google avatar images: they change rarely and are the same
// across the app, so serving them from cache avoids repeated network fetches.
// A cached entry older than AVATAR_MAX_AGE_MS is refreshed from the network.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.hostname !== "lh3.googleusercontent.com") return;

  event.respondWith(
    caches.open(AVATAR_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        const dateHeader = cached.headers.get("date");
        const age = dateHeader ? Date.now() - new Date(dateHeader).getTime() : 0;
        if (!dateHeader || age < AVATAR_MAX_AGE_MS) return cached;
      }

      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        // Offline: fall back to a stale cached copy if we have one.
        if (cached) return cached;
        throw error;
      }
    }),
  );
});
