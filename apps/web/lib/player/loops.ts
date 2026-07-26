import type { Trace } from "@oocc/contracts";

/**
 * One loop, rendered as a bracket above the ribbon ticks (docs/PRD.md §6.3).
 * `iterationStarts` holds the step index each iteration begins at (its
 * length is the iteration count — bind a click on any of these sub-spans to
 * `setLoopScope` to scope playback to one loop).
 */
export interface LoopBracket {
  frameId: string;
  headerLine: number;
  startStep: number;
  endStep: number;
  iterationStarts: number[];
  /** Nesting row: 0 sits directly above the ticks, higher rows stack above it. */
  depth: number;
}

/**
 * Detects loop iterations from the step trace alone — no digest, no AST.
 * Within one call activation (a `frame_id`, stable for that call's whole
 * lifetime per docs/PRD.md §3.2), a "line" step whose line number is lower
 * than the previous "line" step's is a backward branch: the source jumped
 * up, which for straight-line Python only happens at the top of a loop
 * body. Each distinct line that is ever jumped back to is a loop header;
 * every jump back to it starts a new iteration. The loop's span closes the
 * first time this frame's line sequence drops below the header line again
 * (control left the loop for an enclosing scope) or the frame ends.
 *
 * Nesting depth is then just containment of step ranges — a call's own
 * steps are always a contiguous sub-range of its caller's, so ranges never
 * partially overlap, only nest or sit disjoint.
 */
export function computeLoopBrackets(trace: Trace): LoopBracket[] {
  const framesInOrder: string[] = [];
  const frameLineSteps = new Map<string, Array<{ line: number; stepIndex: number }>>();
  const frameLastStep = new Map<string, number>();

  for (const step of trace.steps) {
    const top = step.stack[step.stack.length - 1];
    if (!top) continue;
    const frameId = top.frame_id;
    const prevLast = frameLastStep.get(frameId);
    if (prevLast === undefined) framesInOrder.push(frameId);
    frameLastStep.set(frameId, step.i);
    if (step.event !== "line") continue;
    const list = frameLineSteps.get(frameId);
    if (list) {
      list.push({ line: step.line, stepIndex: step.i });
    } else {
      frameLineSteps.set(frameId, [{ line: step.line, stepIndex: step.i }]);
    }
  }

  const brackets: LoopBracket[] = [];

  for (const frameId of framesInOrder) {
    const seq = frameLineSteps.get(frameId);
    if (!seq || seq.length === 0) continue;

    const firstSeen = new Map<number, number>();
    const boundaries = new Map<number, number[]>();
    let prevLine: number | null = null;

    for (const { line, stepIndex } of seq) {
      if (!firstSeen.has(line)) firstSeen.set(line, stepIndex);
      if (prevLine !== null && line < prevLine) {
        const existing = boundaries.get(line);
        if (existing) {
          existing.push(stepIndex);
        } else {
          const first = firstSeen.get(line);
          boundaries.set(line, first !== undefined ? [first, stepIndex] : [stepIndex]);
        }
      }
      prevLine = line;
    }

    const frameEndStep = frameLastStep.get(frameId) ?? seq[seq.length - 1]!.stepIndex;

    for (const [headerLine, iterationStarts] of boundaries) {
      const lastBoundary = iterationStarts[iterationStarts.length - 1]!;
      let endStep = frameEndStep;
      for (const { line, stepIndex } of seq) {
        if (stepIndex <= lastBoundary) continue;
        if (line < headerLine) {
          endStep = stepIndex - 1;
          break;
        }
      }
      brackets.push({
        frameId,
        headerLine,
        startStep: iterationStarts[0]!,
        endStep,
        iterationStarts,
        depth: 0,
      });
    }
  }

  brackets.sort((a, b) => a.startStep - b.startStep || b.endStep - a.endStep);

  for (let i = 0; i < brackets.length; i += 1) {
    const bracket = brackets[i]!;
    let depth = 0;
    for (let j = 0; j < brackets.length; j += 1) {
      if (i === j) continue;
      const other = brackets[j]!;
      const contains =
        other.startStep <= bracket.startStep &&
        other.endStep >= bracket.endStep &&
        (other.startStep !== bracket.startStep || other.endStep !== bracket.endStep);
      if (contains) depth += 1;
    }
    bracket.depth = depth;
  }

  return brackets;
}
