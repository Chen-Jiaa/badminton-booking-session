import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

hydrateRoot(document, <StartClient />);

// Register the service worker (Web Push handlers + avatar caching). Served from
// public/ at /push-sw.js; see the file header for why we don't use vite-plugin-pwa.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/push-sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}
