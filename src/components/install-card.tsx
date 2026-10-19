import { useEffect, useState } from "react";
import { Share, SquarePlus, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Prompts browser visitors to install the PWA. Hidden when already running from the
// home screen, after the user dismisses it, and on browsers that can't install
// (desktop Safari, Firefox, in-app browsers).

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "install-card-dismissed";

function detectStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Older iOS Safari only exposes this flag
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallCard() {
  // Starts hidden so the server render and first client render match
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (detectStandalone() || localStorage.getItem(DISMISSED_KEY)) return;
    const ios = detectIOS();
    setIsIOS(ios);
    if (ios) setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own button
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    // The event can only be used once
    setInstallPrompt(null);
    setVisible(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible || (!isIOS && !installPrompt)) return null;

  return (
    <div className="rise-in relative mb-4 rounded-lg border bg-card p-4 shadow-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Smartphone className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold">Add to Home Screen</p>
      </div>
      {isIOS ? (
        <p className="mt-3 text-sm text-muted-foreground">
          In Safari, tap <Share className="inline h-4 w-4 align-text-bottom text-foreground" />{" "}
          <strong className="text-foreground">Share</strong>, then{" "}
          <SquarePlus className="inline h-4 w-4 align-text-bottom text-foreground" />{" "}
          <strong className="text-foreground">Add to Home Screen</strong>.
        </p>
      ) : (
        <Button className="mt-3 w-full" onClick={handleInstall}>
          Add to Home Screen
        </Button>
      )}
    </div>
  );
}
