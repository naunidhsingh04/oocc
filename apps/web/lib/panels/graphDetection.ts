import type { Trace, Value } from "@oocc/contracts";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { getStateAt, iterateResolvedSteps } from "@/lib/player";
import { isHeapDict, isHeapList, valueToDisplay } from "./heapValue";

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphLayout {
  binding: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export interface GraphView extends GraphLayout {
  visitedNodeIds: ReadonlySet<string>;
  changedEdgeKeys: ReadonlySet<string>; // "a->b"
}

const WIDTH = 360;
const HEIGHT = 260;

function keyLabel(value: Value): string {
  return String(valueToDisplay(value));
}

/** An adjacency dict, generic: a HeapDict whose every value is a ref to a
 * HeapList (of neighbor ids) — same shape structure_detector's
 * `_looks_like_adjacency` rule checks for, independently re-derived here
 * since the frontend has no access to the backend's Python code. */
export function findPrimaryGraphBinding(trace: Trace): string | undefined {
  for (const step of iterateResolvedSteps(trace)) {
    for (const [ref, obj] of Object.entries(step.heap)) {
      if (!isHeapDict(obj) || obj.entries.length === 0) continue;
      const looksLikeAdjacency = obj.entries.every(({ value }) => {
        if (value === null || !("ref" in value)) return false;
        return isHeapList(step.heap[value.ref]);
      });
      if (looksLikeAdjacency) return ref;
    }
  }
  return undefined;
}

/**
 * Merges the adjacency dict across every step (last-seen wins per key,
 * union of edges ever observed) and runs a d3-force simulation exactly
 * once, then freezes the resulting positions — the layout must never
 * drift during playback (docs/PRD.md §4.3's graph panel spec). Memoize
 * this on (trace, binding) only, never on the current step.
 */
export function computeGraphLayout(trace: Trace, binding: string): GraphLayout | null {
  const neighborsByNode = new Map<string, Set<string>>();

  for (const step of iterateResolvedSteps(trace)) {
    const dict = step.heap[binding];
    if (!isHeapDict(dict)) continue;
    for (const { key, value } of dict.entries) {
      const nodeId = keyLabel(key);
      if (!neighborsByNode.has(nodeId)) neighborsByNode.set(nodeId, new Set());
      const listRef = value !== null && "ref" in value ? value.ref : undefined;
      const list = listRef ? step.heap[listRef] : undefined;
      if (!isHeapList(list)) continue;
      for (const item of list.items) {
        const neighborId = keyLabel(item);
        neighborsByNode.get(nodeId)!.add(neighborId);
        if (!neighborsByNode.has(neighborId)) neighborsByNode.set(neighborId, new Set());
      }
    }
  }

  if (neighborsByNode.size === 0) return null;

  const nodeIds = [...neighborsByNode.keys()];
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const [source, neighbors] of neighborsByNode) {
    for (const target of neighbors) {
      const key = [source, target].sort().join("~");
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ source, target });
    }
  }

  interface SimNode {
    id: string;
    x?: number;
    y?: number;
  }
  const simNodes: SimNode[] = nodeIds.map((id) => ({ id }));
  // d3-force's forceLink mutates its input links in place, replacing
  // `source`/`target` string ids with resolved node object references —
  // pass it a throwaway copy so the plain-string `edges` this function
  // returns (and that GraphPanel keys its `nodes.find` lookups against)
  // isn't silently rewritten out from under it.
  const simLinks = edges.map((e) => ({ source: e.source, target: e.target }));
  const simulation = forceSimulation(simNodes)
    .force("link", forceLink(simLinks).id((d: unknown) => (d as SimNode).id).distance(56))
    .force("charge", forceManyBody().strength(-140))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .stop();

  const tickCount = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  for (let i = 0; i < tickCount; i += 1) simulation.tick();

  const nodes: GraphNode[] = simNodes.map((n) => ({
    id: n.id,
    label: n.id,
    x: Math.max(16, Math.min(WIDTH - 16, n.x ?? WIDTH / 2)),
    y: Math.max(16, Math.min(HEIGHT - 16, n.y ?? HEIGHT / 2)),
  }));

  return { binding, nodes, edges, width: WIDTH, height: HEIGHT };
}

export function computeGraphView(
  trace: Trace,
  currentStepIndex: number,
  layout: GraphLayout,
): GraphView {
  const visitedNodeIds = new Set<string>();
  const changedEdgeKeys = new Set<string>();

  // Cumulative up to the current step — "visit order" is a history, not a
  // single-step flash: once BFS/DFS has touched a node, it stays "visited"
  // as playback continues, exactly like the real algorithm's own visited set.
  for (let i = 0; i <= currentStepIndex; i += 1) {
    const step = getStateAt(trace, i);
    if (!step) continue;
    const touchedNodeIds: string[] = [];
    for (const path of step.changed) {
      if (!path.startsWith(`${layout.binding}{`) || !path.endsWith("}")) continue;
      touchedNodeIds.push(path.slice(`${layout.binding}{`.length, -1));
    }
    if (touchedNodeIds.length === 0) continue;

    const dict = step.heap[layout.binding];
    if (!isHeapDict(dict)) continue;
    for (const { key, value } of dict.entries) {
      const nodeId = keyLabel(key);
      if (!touchedNodeIds.includes(nodeId)) continue;
      visitedNodeIds.add(nodeId);
      const listRef = value !== null && "ref" in value ? value.ref : undefined;
      const list = listRef ? step.heap[listRef] : undefined;
      if (!isHeapList(list)) continue;
      for (const item of list.items) {
        changedEdgeKeys.add([nodeId, keyLabel(item)].sort().join("~"));
      }
    }
  }

  return { ...layout, visitedNodeIds, changedEdgeKeys };
}
