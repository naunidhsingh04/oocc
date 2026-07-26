import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeRecursionTree } from "./recursionTreeDetection";

describe("computeRecursionTree", () => {
  it("builds a call tree from fibonacci_recursion and marks repeated (func,args) signatures", () => {
    const { trace } = loadFixture("fibonacci_recursion");
    const view = computeRecursionTree(trace)!;

    expect(view).not.toBeNull();
    expect(view.nodes.length).toBeGreaterThan(1);
    // Naive recursive fibonacci recomputes the same (n) many times — some
    // node must be marked as a recomputation.
    expect(view.nodes.some((n) => n.recomputation)).toBe(true);
    // fibonacci_recursion calls fib(i) separately for several i from
    // module scope (its own "mountain range" pattern) — several
    // independent roots, each a real top-level call, not one shared parent.
    expect(view.nodes.filter((n) => n.parentFrameId === null).length).toBeGreaterThan(1);
  });

  it("returns null for a program with no function calls at all", () => {
    const { trace } = loadFixture("large_trace_40k");
    expect(computeRecursionTree(trace)).toBeNull();
  });
});
