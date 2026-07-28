import { describe, expect, it } from "vitest";
import { CONCEPTS } from "./concepts";
import { computeConceptGraphLayout } from "./conceptGraphLayout";

describe("computeConceptGraphLayout", () => {
  it("places every concept exactly once", () => {
    const layout = computeConceptGraphLayout();
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(CONCEPTS.map((c) => c.id).sort());
  });

  it("places a concept strictly to the right of every one of its prereqs", () => {
    const layout = computeConceptGraphLayout();
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
    for (const node of layout.nodes) {
      for (const prereq of conceptById.get(node.id)!.prereqIds) {
        expect(byId.get(prereq)!.x).toBeLessThan(node.x);
      }
    }
  });

  it("produces one edge per prereq relationship", () => {
    const layout = computeConceptGraphLayout();
    const expectedEdgeCount = CONCEPTS.reduce((sum, c) => sum + c.prereqIds.length, 0);
    expect(layout.edges).toHaveLength(expectedEdgeCount);
  });

  it("never places two nodes at the exact same point", () => {
    const layout = computeConceptGraphLayout();
    const points = layout.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(points).size).toBe(points.length);
  });
});
