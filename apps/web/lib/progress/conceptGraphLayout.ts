import { CONCEPTS, type ConceptDef } from "./concepts";

export interface ConceptNodeLayout {
  id: string;
  level: number;
  x: number;
  y: number;
}

export interface ConceptEdgeLayout {
  from: string;
  to: string;
}

export interface ConceptGraphLayout {
  nodes: ConceptNodeLayout[];
  edges: ConceptEdgeLayout[];
  width: number;
  height: number;
}

const LEVEL_WIDTH = 160;
const ROW_HEIGHT = 72;
const NODE_MARGIN_X = 60;
const NODE_MARGIN_Y = 48;

/** A concept's level is one more than the deepest of its prerequisites'
 * levels (0 if it has none) — a plain longest-path-from-roots computation
 * over the small, acyclic, hand-authored prereq graph in concepts.ts. */
function computeLevel(id: string, defs: ReadonlyMap<string, ConceptDef>, memo: Map<string, number>): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  const def = defs.get(id);
  if (!def || def.prereqIds.length === 0) {
    memo.set(id, 0);
    return 0;
  }
  const level = 1 + Math.max(...def.prereqIds.map((p) => computeLevel(p, defs, memo)));
  memo.set(id, level);
  return level;
}

/**
 * Fixed, deterministic layout for the 12-node prereq DAG — no d3-force
 * needed (the node set never changes at runtime, unlike GraphPanel's
 * per-trace adjacency graphs in `lib/panels/graphDetection.ts`, which do
 * need a real force layout because their shape varies per trace). Nodes
 * are columned by prerequisite depth (roots on the left) and stacked
 * top-to-bottom within a column in declaration order.
 */
export function computeConceptGraphLayout(): ConceptGraphLayout {
  const defs = new Map(CONCEPTS.map((c) => [c.id, c]));
  const memo = new Map<string, number>();
  const levels = new Map<string, number>();
  for (const concept of CONCEPTS) {
    levels.set(concept.id, computeLevel(concept.id, defs, memo));
  }

  const countPerLevel = new Map<number, number>();
  const nodes: ConceptNodeLayout[] = CONCEPTS.map((concept) => {
    const level = levels.get(concept.id)!;
    const row = countPerLevel.get(level) ?? 0;
    countPerLevel.set(level, row + 1);
    return {
      id: concept.id,
      level,
      x: NODE_MARGIN_X + level * LEVEL_WIDTH,
      y: NODE_MARGIN_Y + row * ROW_HEIGHT,
    };
  });

  const maxLevel = Math.max(0, ...nodes.map((n) => n.level));
  const maxRows = Math.max(1, ...[...countPerLevel.values()]);

  const edges: ConceptEdgeLayout[] = [];
  for (const concept of CONCEPTS) {
    for (const prereq of concept.prereqIds) {
      edges.push({ from: prereq, to: concept.id });
    }
  }

  return {
    nodes,
    edges,
    width: NODE_MARGIN_X * 2 + maxLevel * LEVEL_WIDTH,
    height: NODE_MARGIN_Y * 2 + (maxRows - 1) * ROW_HEIGHT,
  };
}
