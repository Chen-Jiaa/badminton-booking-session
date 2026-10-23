import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_SECTIONS } from "@/features/faq/content";

/** Tap-to-expand questions under their headings. `open` is the question id to show first. */
export function FaqList({ open }: { open?: string }) {
  const target = useRef<HTMLDetailsElement>(null);

  // Arriving from a "?" link: bring that answer into view
  useEffect(() => {
    target.current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className="space-y-10">
      {FAQ_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
          <div className="divide-y border-y">
            {section.items.map((item) => (
              <details
                key={`${item.id}-${open === item.id}`}
                ref={open === item.id ? target : undefined}
                open={open === item.id}
                className="group"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{item.question}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </summary>
                <div className="space-y-2 pb-4 text-sm text-foreground">
                  {item.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
