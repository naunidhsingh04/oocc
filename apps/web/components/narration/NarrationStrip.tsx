"use client";

import { indexForStepRef, usePlayerStore } from "@/lib/player";

/**
 * The narrator's step-range summaries as labelled segments directly above
 * the ribbon (docs/PRD.md Phase 3 frontend spec item 4) — scrubbing reads
 * as "partitioning around pivot 7" instead of "steps 412–488". Uses the
 * same linear step->x mapping as the ribbon itself
 * (components/ribbon/tickBins.ts's `stepToX`, `step / (stepCount - 1)`) so
 * a segment's edges line up with the ticks directly beneath it. Clicking a
 * segment scopes playback to it (the same loop-scope mechanism a ribbon
 * bracket click already uses) and scrubs to its start.
 */
export function NarrationStrip() {
  const trace = usePlayerStore((state) => state.trace);
  const stepRanges = usePlayerStore((state) => state.narration.step_ranges);
  const setLoopScope = usePlayerStore((state) => state.setLoopScope);
  const jumpToStepRef = usePlayerStore((state) => state.jumpToStepRef);

  if (!trace || stepRanges.length === 0) return null;
  const stepCount = trace.steps.length;
  const span = Math.max(1, stepCount - 1);

  return (
    <div
      className="relative h-5 w-full shrink-0 border-t border-rule bg-paper"
      data-testid="narration-strip"
    >
      {stepRanges.map((range, i) => {
        const startIndex = indexForStepRef(trace, range.step_range[0]) ?? 0;
        const endIndex = indexForStepRef(trace, range.step_range[1]) ?? stepCount - 1;
        const leftPct = (startIndex / span) * 100;
        const widthPct = Math.max(((endIndex - startIndex) / span) * 100, 0.6);

        return (
          <button
            key={`${range.step_range[0]}-${range.step_range[1]}-${i}`}
            type="button"
            onClick={() => {
              setLoopScope({ start: startIndex, end: endIndex });
              jumpToStepRef(range.step_range[0]);
            }}
            title={range.summary}
            className="absolute inset-y-0 overflow-hidden truncate border-r border-rule px-1.5 text-left font-mono-label text-[10px] uppercase tracking-[0.04em] text-ink-soft transition-colors hover:bg-paper hover:text-signal"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            {range.summary}
          </button>
        );
      })}
    </div>
  );
}
