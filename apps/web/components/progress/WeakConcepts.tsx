import { conceptChannelColor } from "@/lib/progress/concepts";
import { masteryFillRatio, masteryPercentLabel } from "@/lib/progress/mastery";
import { resolvePracticeTarget } from "@/lib/progress/weakConcepts";
import type { ConceptProgressView } from "@/lib/progress/types";
import { EmptyState, Panel } from "@oocc/ui";
import Link from "next/link";

export interface WeakConceptsProps {
  concepts: readonly ConceptProgressView[];
}

/** Brief item 4: weak concepts, each with a direct "practice this" action.
 * A thin horizontal fill bar (same fill-strength encoding as the concept
 * graph's nodes, `masteryFillRatio`) instead of a numeric-only list — the
 * one number kept is the percent, since that's what decides how urgently
 * to practice something. */
export function WeakConcepts({ concepts }: WeakConceptsProps) {
  return (
    <Panel title="Weak concepts" bodyClassName="min-h-[12rem]">
      {concepts.length === 0 ? (
        <EmptyState title="No weak spots" description="Nothing you've attempted is below the review threshold." />
      ) : (
        <ul className="divide-y divide-rule">
          {concepts.map((concept) => {
            const target = resolvePracticeTarget(concept.conceptId);
            const fillRatio = masteryFillRatio(concept.mastery);
            return (
              <li key={concept.conceptId} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="font-body text-[13px] font-medium text-ink">{concept.title}</span>
                    <span className="font-mono-label text-[11px] text-ink-soft">
                      {masteryPercentLabel(concept.mastery)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full border border-rule">
                    <div
                      className="h-full"
                      style={{ width: `${fillRatio * 100}%`, backgroundColor: conceptChannelColor(concept.conceptId) }}
                      aria-hidden
                    />
                  </div>
                </div>
                {target ? (
                  <Link
                    href={target.kind === "curriculum" ? `/curriculum/${target.slug}` : `/problems/${target.slug}`}
                    className="shrink-0 font-mono-label text-[11px] uppercase tracking-[0.04em] text-signal hover:underline"
                  >
                    Practice this →
                  </Link>
                ) : (
                  <span className="shrink-0 font-mono-label text-[11px] uppercase tracking-[0.04em] text-ink-soft">
                    No material yet
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
