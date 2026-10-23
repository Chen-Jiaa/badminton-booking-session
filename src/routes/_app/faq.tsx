import { createFileRoute } from "@tanstack/react-router";
import { FaqList } from "@/features/faq/faq-list";

export const Route = createFileRoute("/_app/faq")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" ? { q: search.q } : {},
  component: FaqPage,
});

function FaqPage() {
  const { q } = Route.useSearch();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Help &amp; FAQ</h1>
      <FaqList open={q} />
    </div>
  );
}
