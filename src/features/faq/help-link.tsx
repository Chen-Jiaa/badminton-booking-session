import { useState } from "react";
import { CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FAQ_SECTIONS } from "@/features/faq/content";
import { cn } from "@/lib/utils";

const ITEMS = FAQ_SECTIONS.flatMap((section) => section.items);

/** Small "?" that pops up one FAQ answer (by id from content.ts) without leaving the page. */
export function HelpLink({
  q,
  label,
  className,
}: {
  q: string;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const item = ITEMS.find((i) => i.id === q);
  if (!item) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors [@media(hover:hover)]:hover:text-foreground",
          className,
        )}
      >
        <CircleHelp className="h-4 w-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{item.question}</DialogTitle>
            <DialogDescription className="sr-only">Answer</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-foreground">
            {item.answer.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
