import type { Step, Trace } from "@oocc/contracts";
import { isHeapList, valueToDisplay } from "./heapValue";

export interface ListItemsView {
  binding: string;
  values: Array<string | number>;
  changedIndices: ReadonlySet<number>;
}

/** Shared by stack/queue panels — same underlying shape as a plain array,
 * just rendered with push/pop semantics instead of index arithmetic; reuse
 * arrayDetection's own binding-finding rule would double count with the
 * array panel, so callers pass the plan's `binding` (from structure_detector,
 * which already told stack from queue from array by access pattern) —
 * this module only auto-detects as a standalone-render fallback. */
export function findPrimaryListBinding(trace: Trace): string | undefined {
  for (const step of trace.steps) {
    for (const [ref, obj] of Object.entries(step.heap)) {
      if (isHeapList(obj)) return ref;
    }
  }
  return undefined;
}

export function computeListItemsView(
  step: Step | undefined,
  binding: string | undefined,
): ListItemsView | null {
  if (!step || !binding) return null;
  const obj = step.heap[binding];
  if (!isHeapList(obj)) return null;

  const values = obj.items.map(valueToDisplay);
  const changedIndices = new Set<number>();
  const prefix = `${binding}[`;
  for (const path of step.changed) {
    if (!path.startsWith(prefix) || !path.endsWith("]")) continue;
    const index = Number(path.slice(prefix.length, -1));
    if (Number.isInteger(index)) changedIndices.add(index);
  }
  return { binding, values, changedIndices };
}
