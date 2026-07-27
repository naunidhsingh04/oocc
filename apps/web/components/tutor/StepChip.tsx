"use client";

import { usePlayerStore } from "@/lib/player";

/**
 * Every `step_refs` entry renders as one of these (docs/PRD.md Phase 3
 * frontend spec item 2): a flat monospace chip, not a rounded chat-bubble
 * pill — clicking it scrubs the player to that real step and pulses the
 * ribbon there (`jumpToStepRef`), so the claim right next to it is
 * something you can go look at, not just read.
 */
export function StepChip({ stepRef }: { stepRef: number }) {
  const jumpToStepRef = usePlayerStore((state) => state.jumpToStepRef);

  return (
    <button
      type="button"
      onClick={() => jumpToStepRef(stepRef)}
      data-testid={`step-chip-${stepRef}`}
      className="inline-flex items-center rounded-control border border-rule px-1.5 py-0.5 font-mono-label text-[10px] uppercase tracking-[0.04em] text-signal transition-colors hover:border-signal hover:bg-paper"
    >
      step {stepRef}
    </button>
  );
}
