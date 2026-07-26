import type { Step, Trace } from "@oocc/contracts";
import type { ChannelAssignment } from "./channels";

export type TickCategory = "call" | "return" | "assignment" | "comparison" | "exception" | "stdout";

export interface TickInfo {
  category: TickCategory;
  /** Set only for "assignment" ticks where the mutated value resolves to a named local. */
  channel?: number | undefined;
  depth: number;
}

const LOCAL_PATH = /^f\d+\.([A-Za-z_][A-Za-z0-9_]*)$/;
const HEAP_PATH = /^(o\d+)(?:\[[0-9]+\]|\.[A-Za-z_][A-Za-z0-9_]*|\{[^{}]*\})$/;

function resolveChannelForPath(step: Step, path: string, channels: ChannelAssignment): number | undefined {
  const localMatch = LOCAL_PATH.exec(path);
  if (localMatch) {
    return channels.get(localMatch[1]!);
  }

  const heapMatch = HEAP_PATH.exec(path);
  if (heapMatch) {
    const ref = heapMatch[1]!;
    for (const frame of step.stack) {
      for (const [name, value] of Object.entries(frame.locals)) {
        if (value && typeof value === "object" && "ref" in value && value.ref === ref) {
          return channels.get(name);
        }
      }
    }
  }

  return undefined;
}

/**
 * Classifies every step once, on trace load — docs/PRD.md §6.3: "bin the
 * ticks once, never per frame." The ribbon then only ever re-reads this
 * array plus its own pixel-bucket cache; it never re-walks `trace.steps`.
 */
export function computeStepTicks(trace: Trace, channels: ChannelAssignment): TickInfo[] {
  const ticks: TickInfo[] = new Array(trace.steps.length);

  for (const step of trace.steps) {
    const depth = step.depth;
    switch (step.event) {
      case "call":
        ticks[step.i] = { category: "call", depth };
        break;
      case "return":
        ticks[step.i] = { category: "return", depth };
        break;
      case "exception":
        ticks[step.i] = { category: "exception", depth };
        break;
      case "stdout":
        ticks[step.i] = { category: "stdout", depth };
        break;
      case "line": {
        if (step.changed.length === 0) {
          ticks[step.i] = { category: "comparison", depth };
        } else {
          const channel = resolveChannelForPath(step, step.changed[0]!, channels);
          ticks[step.i] = { category: "assignment", channel, depth };
        }
        break;
      }
      default:
        ticks[step.i] = { category: "comparison", depth };
    }
  }

  return ticks;
}
