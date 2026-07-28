import type { Step, Trace } from "@oocc/contracts";
import { applyJsonPatch, type JsonPatchOp } from "./jsonPatch";

/**
 * A step as every panel actually receives it: `heap` reconstructed and
 * therefore always present, `heap_patch` never present. The raw `@oocc/
 * contracts` `Step` type has `heap` as optional (§3.4, Phase 6) because
 * that's honestly what's on the wire; nothing downstream of `getStateAt`
 * should have to re-litigate that per call site, so every panel/detection
 * module takes a `ResolvedStep`, not a `Step`.
 */
export type ResolvedStep = Step & { heap: NonNullable<Step["heap"]> };

/**
 * The single seam PRD §3.4 calls out: every panel reads trace state through
 * this function, never through `trace.steps[i]` directly. Phase 6 shipped
 * the keyframe-every-50-steps + RFC-6902 JSON Patch wire format this
 * function was always meant to absorb — nothing outside this file changed.
 *
 * A step with its own `heap` is a keyframe (every trace's step 0 always is,
 * whether or not the rest of it uses the interval scheme — a trace produced
 * before Phase 6 shipped has `heap` on *every* step, which this function
 * treats identically: each such step is trivially its own keyframe, so the
 * fast path below handles both old and new traces without a version check).
 * A step with `heap_patch` instead needs its heap reconstructed by walking
 * back to the nearest preceding keyframe and replaying every intervening
 * step's patch, in order — see `apps/api/app/storage/wire_codec.py` for the
 * encoder this decodes.
 */
export function getStateAt(trace: Trace | null, i: number): ResolvedStep | undefined {
  if (!trace) return undefined;
  const step = trace.steps[i];
  if (!step) return undefined;
  if (step.heap !== undefined) return step as ResolvedStep;

  return reconstructStep(trace, i, step);
}

/**
 * Every fully-resolved step in a trace, in order — for the handful of
 * `lib/panels/*Detection.ts` binding-auto-detectors that scan the *whole*
 * trace once (memoized on `trace` alone) looking for the first/richest/
 * most-common heap shape of a given kind. Those scans need real heap data
 * at every position, not just at keyframes, so they go through this rather
 * than `trace.steps` directly — the one exception to "index by position
 * into `trace.steps`" that isn't a `getStateAt` call, and it still routes
 * through `getStateAt` under the hood.
 */
export function* iterateResolvedSteps(trace: Trace): Generator<ResolvedStep> {
  for (let i = 0; i < trace.steps.length; i += 1) {
    yield getStateAt(trace, i)!;
  }
}

// Single-slot memo: the common case is several panels each calling
// `getStateAt(trace, currentStep)` within the same render pass. Without
// this, each would get a fresh object for an unchanged (trace, i) pair,
// which — same class of bug as the Zustand-selector-returns-a-fresh-array
// issue documented elsewhere in this codebase — reads as "changed every
// time" to anything comparing by reference. Deliberately not a bigger
// cache: reconstruction cost is bounded by the keyframe interval (~49
// patches, not trace length), so there's nothing to gain from caching
// beyond "the last thing anyone asked for."
let memoTrace: Trace | null = null;
let memoIndex = -1;
let memoResult: ResolvedStep | undefined;

function reconstructStep(trace: Trace, i: number, step: Step): ResolvedStep {
  if (memoTrace === trace && memoIndex === i) return memoResult!;

  let keyframePos = i;
  while (trace.steps[keyframePos]!.heap === undefined) keyframePos -= 1;

  let heap: Record<string, unknown> = structuredCloneJson(trace.steps[keyframePos]!.heap!);
  for (let pos = keyframePos + 1; pos <= i; pos += 1) {
    const s = trace.steps[pos]!;
    if (s.heap !== undefined) {
      heap = structuredCloneJson(s.heap);
    } else {
      applyJsonPatch(heap, (s.heap_patch ?? []) as JsonPatchOp[]);
    }
  }

  const result = { ...step, heap } as ResolvedStep;
  delete (result as { heap_patch?: unknown }).heap_patch;

  memoTrace = trace;
  memoIndex = i;
  memoResult = result;
  return result;
}

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function clampStep(trace: Trace | null, i: number): number {
  if (!trace || trace.steps.length === 0) return 0;
  return Math.min(Math.max(i, 0), trace.steps.length - 1);
}

/**
 * Every player action (`jumpTo`, the ribbon's `playheadStep`, ...) takes an
 * *array position* into `trace.steps`, not a step's own `.i` value — those
 * differ for a head+tail-truncated trace (see lib/player/ticks.ts's
 * identical gotcha). AI surfaces (tutor step_refs, insight step_refs) only
 * ever have real `.i` values, so every one of them must be translated
 * through this function before being handed to `jumpTo` or the ribbon.
 */
export function indexForStepRef(trace: Trace | null, stepRef: number): number | null {
  if (!trace) return null;
  const index = trace.steps.findIndex((step) => step.i === stepRef);
  return index === -1 ? null : index;
}
