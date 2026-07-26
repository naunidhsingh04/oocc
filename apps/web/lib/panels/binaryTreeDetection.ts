import type { HeapInstance, Step, Trace } from "@oocc/contracts";
import { isHeapInstance, isNoneValue, refOf, valueToDisplay } from "./heapValue";

export interface BinaryTreeNodeData {
  ref: string;
  label: string;
  x: number;
  y: number;
  parentRef: string | null;
  changed: boolean;
}

export interface BinaryTreeView {
  binding: string;
  nodes: BinaryTreeNodeData[];
  width: number;
  height: number;
}

const NODE_SPACING_X = 48;
const NODE_SPACING_Y = 64;
const MAX_NODES = 500;

/** Up to two fields whose values are consistently None or a ref to the
 * same type — a binary tree's left/right, found by shape alone. */
function findChildFields(trace: Trace, typeName: string): string[] {
  const candidates = new Set<string>();
  const disqualified = new Set<string>();
  for (const step of trace.steps) {
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
  return [...candidates].slice(0, 2);
}

function findLabelField(trace: Trace, typeName: string, childFields: string[]): string | undefined {
  for (const step of trace.steps) {
    for (const obj of Object.values(step.heap)) {
      if (!isHeapInstance(obj) || obj.type !== typeName) continue;
      for (const [field, value] of Object.entries(obj.fields)) {
        if (childFields.includes(field)) continue;
        if (value === null || "val" in value) return field;
      }
    }
  }
  return undefined;
}

export function findPrimaryBinaryTreeRoot(trace: Trace): string | undefined {
  const typeCounts = new Map<string, number>();
  for (const step of trace.steps) {
    for (const obj of Object.values(step.heap)) {
      if (isHeapInstance(obj)) typeCounts.set(obj.type, (typeCounts.get(obj.type) ?? 0) + 1);
    }
  }
  for (const [typeName] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    if (findChildFields(trace, typeName).length === 2) {
      for (const step of trace.steps) {
        for (const [ref, obj] of Object.entries(step.heap)) {
          if (isHeapInstance(obj) && obj.type === typeName) return ref;
        }
      }
    }
  }
  return undefined;
}

interface RawNode {
  ref: string;
  label: string;
  changed: boolean;
  children: RawNode[];
}

function buildRawTree(
  trace: Trace,
  step: Step,
  ref: string,
  childFields: string[],
  labelField: string | undefined,
  visited: Set<string>,
): RawNode | null {
  if (visited.has(ref) || visited.size >= MAX_NODES) return null; // cycle guard, per structure_detector's own rule
  visited.add(ref);
  const obj = step.heap[ref] as HeapInstance | undefined;
  if (!obj || !("fields" in obj)) return null;

  const changed = step.changed.some((path) => path.startsWith(`${ref}.`) || path === ref);
  const label = labelField ? String(valueToDisplay(obj.fields[labelField] ?? null)) : ref;

  const children: RawNode[] = [];
  for (const field of childFields) {
    const value = obj.fields[field] ?? null;
    if (isNoneValue(value)) continue;
    const childRef = refOf(value);
    if (!childRef) continue;
    const child = buildRawTree(trace, step, childRef, childFields, labelField, visited);
    if (child) children.push(child);
  }

  return { ref, label, changed, children };
}

/** Tidy tree layout: each node's x is the mean of its children's x (or a
 * running leaf counter for leaves), y is depth — the classic Reingold-
 * Tilford shape, computed without pulling in d3-hierarchy for a plain
 * binary tree (two children max makes the naive version already tidy). */
function layout(node: RawNode, depth: number, nextLeafX: { x: number }, out: BinaryTreeNodeData[], parentRef: string | null): number {
  if (node.children.length === 0) {
    const x = nextLeafX.x;
    nextLeafX.x += NODE_SPACING_X;
    out.push({ ref: node.ref, label: node.label, x, y: depth * NODE_SPACING_Y, parentRef, changed: node.changed });
    return x;
  }
  const childXs = node.children.map((child) => layout(child, depth + 1, nextLeafX, out, node.ref));
  const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
  out.push({ ref: node.ref, label: node.label, x, y: depth * NODE_SPACING_Y, parentRef, changed: node.changed });
  return x;
}

export function computeBinaryTreeView(
  trace: Trace | null,
  step: Step | undefined,
  binding: string | undefined,
): BinaryTreeView | null {
  if (!trace || !step || !binding) return null;
  const root = step.heap[binding];
  if (!isHeapInstance(root)) return null;

  const childFields = findChildFields(trace, root.type);
  if (childFields.length === 0) return null;
  const labelField = findLabelField(trace, root.type, childFields);

  const raw = buildRawTree(trace, step, binding, childFields, labelField, new Set());
  if (!raw) return null;

  const out: BinaryTreeNodeData[] = [];
  const nextLeafX = { x: 0 };
  layout(raw, 0, nextLeafX, out, null);

  const width = Math.max(NODE_SPACING_X, ...out.map((n) => n.x)) + NODE_SPACING_X;
  const height = Math.max(...out.map((n) => n.y)) + NODE_SPACING_Y;

  return { binding, nodes: out, width, height };
}
