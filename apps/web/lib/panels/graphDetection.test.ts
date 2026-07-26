import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeGraphLayout, computeGraphView, findPrimaryGraphBinding } from "./graphDetection";

describe("findPrimaryGraphBinding", () => {
  it("finds bfs_graph's adjacency dict by shape", () => {
    const { trace } = loadFixture("bfs_graph");
    expect(findPrimaryGraphBinding(trace)).toBeDefined();
  });
});

describe("computeGraphLayout", () => {
  it("never mutates its own returned edges when re-run (regression: d3-force mutates link objects in place)", () => {
    const { trace } = loadFixture("bfs_graph");
    const binding = findPrimaryGraphBinding(trace)!;
    const layout = computeGraphLayout(trace, binding)!;

    expect(layout).not.toBeNull();
    for (const edge of layout.edges) {
      expect(typeof edge.source).toBe("string");
      expect(typeof edge.target).toBe("string");
    }
    // Every edge endpoint must resolve to a real node — this is exactly
    // the assertion that would fail if d3-force's mutation leaked through.
    const nodeIds = new Set(layout.nodes.map((n) => n.id));
    for (const edge of layout.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("produces the same node set on repeated calls (frozen layout, not drifting)", () => {
    const { trace } = loadFixture("bfs_graph");
    const binding = findPrimaryGraphBinding(trace)!;
    const first = computeGraphLayout(trace, binding)!;
    const second = computeGraphLayout(trace, binding)!;
    expect(first.nodes.map((n) => n.id).sort()).toEqual(second.nodes.map((n) => n.id).sort());
  });
});

describe("computeGraphView", () => {
  it("accumulates visited nodes cumulatively as playback advances", () => {
    const { trace } = loadFixture("bfs_graph");
    const binding = findPrimaryGraphBinding(trace)!;
    const layout = computeGraphLayout(trace, binding)!;

    const early = computeGraphView(trace, 5, layout);
    const late = computeGraphView(trace, trace.steps.length - 1, layout);

    for (const id of early.visitedNodeIds) {
      expect(late.visitedNodeIds.has(id)).toBe(true);
    }
    expect(late.visitedNodeIds.size).toBeGreaterThanOrEqual(early.visitedNodeIds.size);
  });
});
