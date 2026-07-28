import type { HeapList, HeapObject, Trace, Value } from "@oocc/contracts";
import type { ChannelAssignment, ResolvedStep } from "@/lib/player";
import { iterateResolvedSteps } from "@/lib/player";

export interface ArrayPointer {
  name: string;
  index: number;
  channel: number;
}

export interface ArrayWindow {
  fromIndex: number;
  toIndex: number;
  fromName: string;
  toName: string;
}

export interface ArrayView {
  binding: string;
  values: Array<string | number>;
  changedIndices: ReadonlySet<number>;
  pointers: ArrayPointer[];
  window: ArrayWindow | null;
}

function isPrimitiveValue(value: Value): boolean {
  return value === null || (typeof value === "object" && "val" in value);
}

/**
 * `HeapInstance.type` is a bare `string` in the generated contract (any
 * user class name), so a plain `obj.type === "list"` check doesn't
 * structurally exclude it. Narrowing on `"items" in obj` does — only
 * HeapList/HeapTuple/HeapSet have that field — and combined with the type
 * check that's exactly HeapList.
 */
function asHeapList(obj: HeapObject | undefined): HeapList | null {
  if (!obj || obj.type !== "list" || !("items" in obj)) return null;
  return obj;
}

function isPrimitiveList(obj: HeapList): boolean {
  return obj.items.every(isPrimitiveValue);
}

/**
 * Finds "the array" this trace is about, generically: the first list-of-
 * primitives that ever appears in any step's heap, preferring one whose
 * elements are plain numbers/strings over one holding nested references.
 * No sorting algorithm, no fixture name, no special-casing — this is what
 * lets the same component animate bubble_sort and quicksort_partition with
 * zero code changes.
 */
export function findPrimaryArrayBinding(trace: Trace): string | undefined {
  let fallback: string | undefined;
  for (const step of iterateResolvedSteps(trace)) {
    for (const [ref, obj] of Object.entries(step.heap)) {
      const list = asHeapList(obj);
      if (!list) continue;
      if (isPrimitiveList(list)) return ref;
      fallback ??= ref;
    }
  }
  return fallback;
}

function valueToDisplay(value: Value): string | number {
  if (value === null) return "None";
  if ("val" in value) {
    if (value.val === null) return value.repr ?? "None";
    if (typeof value.val === "number" || typeof value.val === "string") return value.val;
    return JSON.stringify(value.val);
  }
  return `→${value.ref}`;
}

function inlineNumber(value: Value): number | null {
  if (value === null || !("val" in value)) return null;
  return typeof value.val === "number" && Number.isInteger(value.val) ? value.val : null;
}

/**
 * Reads the array's current state straight off the step + `changed` — no
 * knowledge of what produced it. Pointer annotations are any in-scope local
 * whose integer value happens to be a valid index; a window is drawn
 * between the lowest and highest such pointer when there are at least two,
 * the same generic rule that produces a `lo`/`hi` window for binary search
 * and a `left`/`right` window for quicksort's partition.
 */
export function computeArrayView(
  step: ResolvedStep | undefined,
  binding: string | undefined,
  channels: ChannelAssignment,
): ArrayView | null {
  if (!step || !binding) return null;
  const heapObj = asHeapList(step.heap[binding]);
  if (!heapObj) return null;

  const values = heapObj.items.map(valueToDisplay);

  const changedIndices = new Set<number>();
  const prefix = `${binding}[`;
  for (const path of step.changed) {
    if (!path.startsWith(prefix) || !path.endsWith("]")) continue;
    const index = Number(path.slice(prefix.length, -1));
    if (Number.isInteger(index)) changedIndices.add(index);
  }

  let pointers: ArrayPointer[] = [];
  for (let i = step.stack.length - 1; i >= 0; i -= 1) {
    const frame = step.stack[i]!;
    for (const [name, value] of Object.entries(frame.locals)) {
      const index = inlineNumber(value);
      if (index !== null && index >= 0 && index < heapObj.len) {
        pointers.push({ name, index, channel: channels.get(name) ?? 1 });
      }
    }
    if (pointers.length > 0) break; // innermost frame with any hits wins — no outer-scope shadowing
  }
  // Stable order for rendering/testing: by index, then name.
  pointers = pointers.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));

  let window: ArrayWindow | null = null;
  if (pointers.length >= 2) {
    const lo = pointers[0]!;
    const hi = pointers[pointers.length - 1]!;
    if (lo.index !== hi.index) {
      window = { fromIndex: lo.index, toIndex: hi.index, fromName: lo.name, toName: hi.name };
    }
  }

  return { binding, values, changedIndices, pointers, window };
}
