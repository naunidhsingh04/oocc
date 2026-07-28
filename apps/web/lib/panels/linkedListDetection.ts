import type { HeapInstance, Trace } from "@oocc/contracts";
import { iterateResolvedSteps, type ResolvedStep } from "@/lib/player";
import { isHeapInstance, isNoneValue, refOf, valueToDisplay } from "./heapValue";

export interface LinkedListNode {
  ref: string;
  label: string;
  nextRef: string | null; // null = end of chain
  changed: boolean;
}

export interface LinkedListView {
  binding: string;
  nodes: LinkedListNode[];
  hasCycle: boolean;
}

const MAX_NODES = 200; // guards against a genuine cycle producing an infinite chain

/** Any field on a user instance whose value is consistently either None or
 * a reference to another instance of the *same* type — the shape-only
 * rule that finds "next" without ever reading the name "next". Picks the
 * first such field found, by first-appearance order. */
function findPointerField(trace: Trace, typeName: string): string | undefined {
  const candidates = new Set<string>();
  const disqualified = new Set<string>();
  for (const step of iterateResolvedSteps(trace)) {
    for (const obj of Object.values(step.heap)) {
      if (!isHeapInstance(obj) || obj.type !== typeName) continue;
      for (const [field, value] of Object.entries(obj.fields)) {
        if (disqualified.has(field)) continue;
        if (isNoneValue(value)) {
          candidates.add(field);
          continue;
        }
        const ref = refOf(value);
        const target = ref ? step.heap[ref] : undefined;
        if (ref && isHeapInstance(target) && target.type === typeName) {
          candidates.add(field);
        } else {
          disqualified.add(field);
          candidates.delete(field);
        }
      }
    }
  }
  return [...candidates][0];
}

/** A primitive field on the node (e.g. `val`), for node labels — the first
 * field that's ever an inline (non-ref) value across the trace. */
function findLabelField(trace: Trace, typeName: string, pointerField: string): string | undefined {
  for (const step of iterateResolvedSteps(trace)) {
    for (const obj of Object.values(step.heap)) {
      if (!isHeapInstance(obj) || obj.type !== typeName) continue;
      for (const [field, value] of Object.entries(obj.fields)) {
        if (field === pointerField) continue;
        if (value === null || "val" in value) return field;
      }
    }
  }
  return undefined;
}

export function findPrimaryLinkedListRoot(trace: Trace): string | undefined {
  const typeCounts = new Map<string, number>();
  for (const step of iterateResolvedSteps(trace)) {
    for (const obj of Object.values(step.heap)) {
      if (isHeapInstance(obj)) typeCounts.set(obj.type, (typeCounts.get(obj.type) ?? 0) + 1);
    }
  }
  for (const [typeName] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    if (findPointerField(trace, typeName)) {
      for (const step of iterateResolvedSteps(trace)) {
        for (const [ref, obj] of Object.entries(step.heap)) {
          if (isHeapInstance(obj) && obj.type === typeName) return ref;
        }
      }
    }
  }
  return undefined;
}

export function computeLinkedListView(
  trace: Trace | null,
  step: ResolvedStep | undefined,
  binding: string | undefined,
): LinkedListView | null {
  if (!trace || !step || !binding) return null;
  const root = step.heap[binding];
  if (!isHeapInstance(root)) return null;

  const pointerField = findPointerField(trace, root.type);
  if (!pointerField) return null;
  const labelField = findLabelField(trace, root.type, pointerField);

  const nodes: LinkedListNode[] = [];
  const visited = new Set<string>();
  let cursor: string | undefined = binding;
  let hasCycle = false;

  while (cursor && nodes.length < MAX_NODES) {
    if (visited.has(cursor)) {
      hasCycle = true;
      break;
    }
    visited.add(cursor);
    const obj: HeapInstance | undefined = step.heap[cursor] as HeapInstance | undefined;
    if (!obj || !("fields" in obj)) break;

    const changed = step.changed.some((path) => path.startsWith(`${cursor}.`) || path === cursor);
    const label = labelField ? String(valueToDisplay(obj.fields[labelField] ?? null)) : cursor;
    const nextValue = obj.fields[pointerField] ?? null;
    const nextRef = isNoneValue(nextValue) ? null : (refOf(nextValue) ?? null);

    nodes.push({ ref: cursor, label, nextRef, changed });
    cursor = nextRef ?? undefined;
  }

  return { binding, nodes, hasCycle };
}
