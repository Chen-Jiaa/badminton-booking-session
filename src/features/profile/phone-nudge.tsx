import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, X } from "lucide-react";

const DISMISSED_KEY = "phone-nudge-dismissed-at";
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Asks players without a number on file to add one. Closing it hides it for 7 days; gone for good once they save a number. */
export function PhoneNudge({ hasPhone }: { hasPhone: boolean | undefined }) {
  // Start hidden so the server render and first client render agree (localStorage is client-only)
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    const closedAt = Number(localStorage.getItem(DISMISSED_KEY));
    setDismissed(Number.isFinite(closedAt) && Date.now() - closedAt < REPROMPT_AFTER_MS);
  }, []);

  if (hasPhone !== false || dismissed) return null;
  return (
    <div className="flex items-center gap-1 rounded-lg bg-brand/40 text-sm text-brand-foreground">
      <Link
        to="/profile"
        className="flex flex-1 items-center gap-2 py-2.5 pl-3 transition-[scale] active:scale-[0.98] motion-reduce:active:scale-100"
      >
        <span className="flex-1">Add your WhatsApp number so admins and hosts can reach you</span>
        <ChevronRight className="h-4 w-4" />
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        className="flex h-10 w-10 items-center justify-center"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, String(Date.now()));
          setDismissed(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
