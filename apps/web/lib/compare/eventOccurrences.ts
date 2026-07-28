import type { Trace } from "@oocc/contracts";
import { type ChannelAssignment, computeLoopBrackets, computeStepTicks } from "@/lib/player";
import type { CompareEventKind } from "./types";

export type EventOccurrences = ReadonlyMap<CompareEventKind, readonly number[]>;

/**
 * Precomputes, once per trace load, the sorted list of step *array
 * positions* (matching `computeStepTicks`'/`getStateAt`'s indexing, never
 * `step.i` — see `lib/player/ticks.ts`'s truncated-trace gotcha) where each
 * `CompareEventKind` occurs. `useComparePlayback` calls this once per side
 * per trace (memoized on the trace object) and never rescans on scrub.
 */
export function computeEventOccurrences(trace: Trace, channels: ChannelAssignment): EventOccurrences {
  const ticks = computeStepTicks(trace, channels);

  const comparison: number[] = [];
  const assignment: number[] = [];
  const call: number[] = [];
  const returnPositions: number[] = [];

  ticks.forEach((tick, pos) => {
    switch (tick.category) {
      case "comparison":
        comparison.push(pos);
        break;
      case "assignment":
        assignment.push(pos);
        break;
      case "call":
        call.push(pos);
        break;
      case "return":
        returnPositions.push(pos);
        break;
      default:
        break;
    }
  });

  // LoopBracket.iterationStarts holds real step `.i` values (loops.ts builds
  // them from `step.i`, not array position), so they need the same
  // `i` -> position translation `getStateAt`'s `indexForStepRef` does.
  const posByStepI = new Map<number, number>();
  trace.steps.forEach((step, pos) => posByStepI.set(step.i, pos));

  const loopIterationSet = new Set<number>();
  for (const bracket of computeLoopBrackets(trace)) {
    for (const stepI of bracket.iterationStarts) {
      const pos = posByStepI.get(stepI);
      if (pos !== undefined) loopIterationSet.add(pos);
    }
  }
  const loopIteration = Array.from(loopIterationSet).sort((a, b) => a - b);

  const map = new Map<CompareEventKind, readonly number[]>();
  map.set("comparison", comparison);
  map.set("assignment", assignment);
  map.set("call", call);
  map.set("return", returnPositions);
  map.set("loop_iteration", loopIteration);
  return map;
}

/** Binary search: how many entries of a sorted, ascending array are <= `pos`. */
export function countAtOrBefore(sorted: readonly number[], pos: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** `round(sourcePos / sourceLastIndex * targetLastIndex)` — see CompareSyncMode's "index" doc comment. */
export function mapPositionProportional(sourcePos: number, sourceLastIndex: number, targetLastIndex: number): number {
  if (sourceLastIndex <= 0) return 0;
  const ratio = sourcePos / sourceLastIndex;
  return Math.round(ratio * targetLastIndex);
}

/**
 * "Sync by the Nth occurrence": counts how many times the chosen event has
 * happened in the source trace at or before `sourcePos`, then jumps to the
 * target trace's own occurrence of that same rank. Degrades to proportional
 * index sync if either trace never produces this event at all (e.g. a
 * fixture with no "return" step) — a silent stall would be worse than a
 * documented fallback.
 */
export function mapPositionByEvent(
  sourceMatches: readonly number[],
  targetMatches: readonly number[],
  sourcePos: number,
  sourceLastIndex: number,
  targetLastIndex: number,
): number {
  if (sourceMatches.length === 0 || targetMatches.length === 0) {
    return mapPositionProportional(sourcePos, sourceLastIndex, targetLastIndex);
  }

  const n = countAtOrBefore(sourceMatches, sourcePos);
  if (n === 0) {
    // Before the first occurrence in the source trace — land target at its
    // own start too, rather than guessing a fractional position.
    return 0;
  }
  const idx = Math.min(n, targetMatches.length) - 1;
  return targetMatches[idx]!;
}
