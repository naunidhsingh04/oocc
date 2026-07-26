import type { Step, Trace } from "@oocc/contracts";
import { isHeapList, valueToDisplay } from "./heapValue";

export interface Array2DView {
  binding: string;
  rows: Array<Array<string | number>>;
  changedCells: ReadonlySet<string>; // "row,col"
  maxValue: number;
}

/** A list of lists, generic — no fixture/algorithm knowledge, same rule as
 * arrayDetection's findPrimaryArrayBinding but one level up: a HeapList
 * whose items are themselves refs to HeapLists. */
export function findPrimaryArray2DBinding(trace: Trace): string | undefined {
  for (const step of trace.steps) {
    for (const [ref, obj] of Object.entries(step.heap)) {
      if (!isHeapList(obj) || obj.items.length === 0) continue;
      const rowsAreLists = obj.items.every(
        (item) => item !== null && typeof item === "object" && "ref" in item && isHeapList(step.heap[item.ref]),
      );
      if (rowsAreLists) return ref;
    }
  }
  return undefined;
}

export function computeArray2DView(
  step: Step | undefined,
  binding: string | undefined,
): Array2DView | null {
  if (!step || !binding) return null;
  const container = step.heap[binding];
  if (!isHeapList(container)) return null;

  const rows: Array<Array<string | number>> = [];
  const rowRefs: string[] = [];
  for (const item of container.items) {
    const ref = item !== null && typeof item === "object" && "ref" in item ? item.ref : undefined;
    const rowList = ref ? step.heap[ref] : undefined;
    if (!isHeapList(rowList)) return null;
    rowRefs.push(ref!);
    rows.push(rowList.items.map(valueToDisplay));
  }

  const changedCells = new Set<string>();
  for (const path of step.changed) {
    const rowIndex = rowRefs.findIndex((ref) => path.startsWith(`${ref}[`));
    if (rowIndex === -1) continue;
    const prefix = `${rowRefs[rowIndex]}[`;
    if (!path.endsWith("]")) continue;
    const colIndex = Number(path.slice(prefix.length, -1));
    if (Number.isInteger(colIndex)) changedCells.add(`${rowIndex},${colIndex}`);
  }

  let maxValue = 1;
  for (const row of rows) {
    for (const value of row) {
      if (typeof value === "number") maxValue = Math.max(maxValue, Math.abs(value));
    }
  }

  return { binding, rows, changedCells, maxValue };
}
