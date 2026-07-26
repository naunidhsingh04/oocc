import type { TickCategory, TickInfo } from "@/lib/player";

export interface TickBin {
  x: number;
  width: number;
  stepStart: number;
  stepEnd: number;
  category: TickCategory;
  channel?: number | undefined;
  maxDepth: number;
}

const MIN_TICK_WIDTH = 2;

const PRIORITY: Record<TickCategory, number> = {
  exception: 5,
  call: 4,
  return: 3,
  assignment: 2,
  comparison: 1,
  stdout: 0,
};

/**
 * Bins the (already-classified) per-step ticks into pixel columns for one
 * canvas width. docs/PRD.md §6.3: "bin the ticks once, never per frame" —
 * this is the once-per-load-or-resize step; `drawRibbon` only ever reads
 * its output, so redraws during scrubbing stay O(canvas width), never
 * O(step count).
 *
 * Short traces get one real 2px tick per step, spaced out proportionally.
 * Once there are more steps than pixel columns, each column aggregates a
 * run of steps into a single tick, picked by event priority (an exception
 * or call always wins over a plain comparison) so nothing important gets
 * silently averaged away.
 */
export function computeTickBins(ticks: readonly TickInfo[], widthPx: number): TickBin[] {
  const stepCount = ticks.length;
  if (stepCount === 0 || widthPx <= 0) return [];

  if (widthPx / stepCount >= MIN_TICK_WIDTH) {
    const bins: TickBin[] = new Array(stepCount);
    for (let i = 0; i < stepCount; i += 1) {
      const tick = ticks[i]!;
      bins[i] = {
        x: (i / stepCount) * widthPx,
        width: MIN_TICK_WIDTH,
        stepStart: i,
        stepEnd: i,
        category: tick.category,
        channel: tick.channel,
        maxDepth: tick.depth,
      };
    }
    return bins;
  }

  const slotCount = Math.max(1, Math.floor(widthPx));
  const bins: TickBin[] = [];
  for (let slot = 0; slot < slotCount; slot += 1) {
    const stepStart = Math.floor((slot / slotCount) * stepCount);
    const stepEnd = Math.min(stepCount - 1, Math.floor(((slot + 1) / slotCount) * stepCount) - 1);
    if (stepEnd < stepStart) continue;

    let best = ticks[stepStart]!;
    let maxDepth = best.depth;
    for (let i = stepStart + 1; i <= stepEnd; i += 1) {
      const tick = ticks[i]!;
      if (PRIORITY[tick.category] > PRIORITY[best.category]) best = tick;
      if (tick.depth > maxDepth) maxDepth = tick.depth;
    }

    bins.push({
      x: slot,
      width: 1,
      stepStart,
      stepEnd,
      category: best.category,
      channel: best.channel,
      maxDepth,
    });
  }
  return bins;
}

export function stepToX(step: number, stepCount: number, widthPx: number): number {
  if (stepCount <= 1) return 0;
  return (step / (stepCount - 1)) * widthPx;
}

export function xToStep(x: number, stepCount: number, widthPx: number): number {
  if (stepCount <= 1 || widthPx <= 0) return 0;
  const step = Math.round((x / widthPx) * (stepCount - 1));
  return Math.min(Math.max(step, 0), stepCount - 1);
}
