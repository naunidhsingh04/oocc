"use client";

import { usePlayerStore } from "@/lib/player";
import { Chip } from "@oocc/ui";

const CURVE_LABEL: Record<string, string> = {
  constant: "O(1)",
  log_n: "O(log n)",
  n: "O(n)",
  n_log_n: "O(n log n)",
  n_squared: "O(n²)",
  n_cubed: "O(n³)",
  exponential: "O(2ⁿ)",
};

/**
 * algorithm_classifier's result next to the measured complexity, exactly
 * as sketched in PRD §6.4 (`binary_search · O(log n)`) — Phase 3 frontend
 * spec item 5. A low-confidence guess says so plainly rather than
 * presenting a guess with the same visual weight as a certainty.
 */
export function AlgorithmBadge() {
  const algorithm = usePlayerStore((state) => state.algorithm);
  const complexity = usePlayerStore((state) => state.analysis?.complexity);

  if (!algorithm && !complexity) return null;

  const bestFit = complexity ? CURVE_LABEL[complexity.best_fit] : null;
  const lowConfidence = algorithm !== null && algorithm.confidence < 0.6;

  return (
    <div className="flex items-center gap-1.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
      {algorithm ? (
        <span data-testid="algorithm-badge" className={lowConfidence ? "italic text-ink-soft" : "text-ink"}>
          {algorithm.algorithm}
          {lowConfidence ? " (guess)" : ""}
        </span>
      ) : null}
      {algorithm && bestFit ? <span aria-hidden>·</span> : null}
      {bestFit ? <Chip tone="neutral">{bestFit}</Chip> : null}
    </div>
  );
}
