import type { Trace } from "@oocc/contracts";
import { valueToDisplay } from "./heapValue";

export interface RecursionNode {
  frameId: string;
  func: string;
  label: string;
  x: number;
  y: number;
  parentFrameId: string | null;
  firstCallStep: number;
  recomputation: boolean;
}

export interface RecursionTreeView {
  nodes: RecursionNode[];
  width: number;
  height: number;
}

const NODE_SPACING_X = 56;
const NODE_SPACING_Y = 56;

interface RawNode {
  frameId: string;
  func: string;
  label: string;
  firstCallStep: number;
  recomputation: boolean;
  children: RawNode[];
}

/**
 * Builds the call graph purely from `event: "call"` transitions: whenever
 * the stack grows by one frame, the new top frame's parent is whatever was
 * on top before. No fixture/algorithm knowledge — this is exactly the
 * "call_site_line links parent to child" rule from the trace contract
 * itself, generalized to any recursive (or non-recursive) call tree.
 */
export function computeRecursionTree(trace: Trace): RecursionTreeView | null {
  const rawByFrameId = new Map<string, RawNode>();
  const roots: RawNode[] = [];
  const signatureFirstSeen = new Map<string, number>();

  let prevDepth = -1;
  let prevTopFrameId: string | null = null;

  for (const step of trace.steps) {
    const depth = step.stack.length;
    if (depth > prevDepth) {
      const top = step.stack[step.stack.length - 1]!;
      // "<module>" is the trace contract's fixed name for top-level scope
      // (never a user function) — entering it isn't a "call" worth a node,
      // it's just where the program starts; a tree with only that one
      // node isn't recursion, it's every program that ever runs.
      if (top.func !== "<module>" && !rawByFrameId.has(top.frame_id)) {
        const args = top.args ?? [];
        const signature = `${top.func}(${args.map((a) => String(valueToDisplay(top.locals[a] ?? null))).join(",")})`;
        const recomputation = signatureFirstSeen.has(signature);
        if (!recomputation) signatureFirstSeen.set(signature, step.i);

        const label = args.length > 0 ? args.map((a) => String(valueToDisplay(top.locals[a] ?? null))).join(",") : top.func;
        const node: RawNode = {
          frameId: top.frame_id,
          func: top.func,
          label,
          firstCallStep: step.i,
          recomputation,
          children: [],
        };
        rawByFrameId.set(top.frame_id, node);
        if (prevTopFrameId && rawByFrameId.has(prevTopFrameId)) {
          rawByFrameId.get(prevTopFrameId)!.children.push(node);
        } else {
          roots.push(node);
        }
      }
    }
    prevDepth = depth;
    prevTopFrameId = step.stack[step.stack.length - 1]?.frame_id ?? null;
  }

  if (roots.length === 0) return null;

  const out: RecursionNode[] = [];
  const nextLeafX = { x: 0 };
  for (const root of roots) layout(root, 0, nextLeafX, out, null);

  const width = Math.max(NODE_SPACING_X, ...out.map((n) => n.x)) + NODE_SPACING_X;
  const height = Math.max(...out.map((n) => n.y)) + NODE_SPACING_Y;
  return { nodes: out, width, height };
}

function layout(
  node: RawNode,
  depth: number,
  nextLeafX: { x: number },
  out: RecursionNode[],
  parentFrameId: string | null,
): number {
  if (node.children.length === 0) {
    const x = nextLeafX.x;
    nextLeafX.x += NODE_SPACING_X;
    out.push({
      frameId: node.frameId,
      func: node.func,
      label: node.label,
      x,
      y: depth * NODE_SPACING_Y,
      parentFrameId,
      firstCallStep: node.firstCallStep,
      recomputation: node.recomputation,
    });
    return x;
  }
  const childXs = node.children.map((child) => layout(child, depth + 1, nextLeafX, out, node.frameId));
  const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
  out.push({
    frameId: node.frameId,
    func: node.func,
    label: node.label,
    x,
    y: depth * NODE_SPACING_Y,
    parentFrameId,
    firstCallStep: node.firstCallStep,
    recomputation: node.recomputation,
  });
  return x;
}
