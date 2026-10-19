import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copy icon that gives way to a tick drawing itself in, with a ring pulsing out. */
export function CopyIcon({ copied, className }: { copied: boolean; className?: string }) {
  return (
    <span className="relative grid place-items-center">
      <Copy
        className={cn(
          "h-4 w-4 [grid-area:1/1] transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          copied && "scale-50 opacity-0",
          className,
        )}
      />
      {copied && (
        <>
          <span
            aria-hidden
            className="copy-ring size-full rounded-full border border-brand-foreground [grid-area:1/1]"
          />
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("tick-draw h-4 w-4 text-brand-foreground [grid-area:1/1]", className)}
          >
            <path d="M20 6 9 17l-5-5" pathLength={1} />
          </svg>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </span>
  );
}
