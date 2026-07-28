/**
 * Compare View (docs/PRD.md §7 Phase 5 frontend: "compare-two-runs" — two
 * runs side by side, one synchronized scrubber).
 *
 * "Event" here is deliberately grounded in data the player already computes
 * for every trace, not a fabricated field:
 *  - "comparison" / "assignment" / "call" / "return" are the same
 *    `TickCategory` values `lib/player/ticks.ts`'s `computeStepTicks`
 *    already classifies every step into (docs/PRD.md §6.3's ribbon tick
 *    colors) — a "comparison" tick is a `line` step whose `changed` is
 *    empty (a condition/index check that didn't mutate anything), an
 *    "assignment" tick is a `line` step that did.
 *  - "loop_iteration" reuses `lib/player/loops.ts`'s `computeLoopBrackets`,
 *    whose `iterationStarts` are exactly "the step a new pass through a
 *    loop body begins" — already detected from the step trace alone for
 *    the ribbon's own bracket rendering.
 *
 * No new trace-shape assumption is introduced: every kind below is a
 * straight reuse of an existing, already-tested classification.
 */
export type CompareEventKind = "comparison" | "assignment" | "call" | "return" | "loop_iteration";

export const COMPARE_EVENT_KINDS: ReadonlyArray<{ value: CompareEventKind; label: string }> = [
  { value: "comparison", label: "Comparison" },
  { value: "assignment", label: "Assignment" },
  { value: "call", label: "Function call" },
  { value: "return", label: "Return" },
  { value: "loop_iteration", label: "Loop iteration" },
];

/**
 * "index" — proportional (percentage-of-own-run) index sync: side B's
 * position is `round(posA / lastIndexA * lastIndexB)`, not a raw clamp.
 * This is the deliberate choice for the flagship bubble-sort-vs-quicksort
 * demo: a raw clamp (`min(posA, lastIndexB)`) makes the shorter run simply
 * freeze at its own last step the moment the longer run's absolute step
 * count passes it, which reads as "this ribbon broke," not "this algorithm
 * finished faster." Proportional sync keeps both playheads visibly moving
 * together at the same *relative* position in each run, so the two step
 * counters (e.g. "9 / 45" next to "126 / 630") are what carry the "dramatically
 * fewer steps for equivalent progress" story, not a stalled scrubber.
 *
 * "event" — sync by the Nth occurrence of `eventKind`: find how many times
 * `eventKind` has occurred in trace A at or before A's current position,
 * then jump B to its own occurrence of that same rank. This is what makes
 * "20% through bubble sort" and "20% through quicksort" mean something
 * comparable in algorithm-progress terms rather than raw step count — e.g.
 * syncing on "comparison" lines up the Nth element-vs-element comparison in
 * each run, regardless of how many call/return/bookkeeping steps a
 * recursive quicksort emits in between.
 */
export type CompareSyncMode = "index" | "event";
