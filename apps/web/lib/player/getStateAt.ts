import type { Step, Trace } from "@oocc/contracts";

/**
 * The single seam PRD §3.4 calls out: every panel reads trace state through
 * this function, never through `trace.steps[i]` directly. Today a trace is a
 * full heap snapshot per step, so this is a plain array index. Phase 6
 * switches the wire format to a keyframe-every-50-steps scheme with RFC-6902
 * JSON Patch deltas between them; when that lands, this function walks back
 * to the nearest keyframe and applies the intervening patches, and nothing
 * outside this file changes.
 */
export function getStateAt(trace: Trace | null, i: number): Step | undefined {
  if (!trace) return undefined;
  return trace.steps[i];
}

export function clampStep(trace: Trace | null, i: number): number {
  if (!trace || trace.steps.length === 0) return 0;
  return Math.min(Math.max(i, 0), trace.steps.length - 1);
}
