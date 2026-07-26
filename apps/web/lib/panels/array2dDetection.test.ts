import { getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeArray2DView, findPrimaryArray2DBinding } from "./array2dDetection";

describe("findPrimaryArray2DBinding", () => {
  it("finds dp_knapsack's table, a list of lists, generically", () => {
    const { trace } = loadFixture("dp_knapsack");
    expect(findPrimaryArray2DBinding(trace)).toBeDefined();
  });

  it("returns undefined for a program with no 2D structure", () => {
    const { trace } = loadFixture("binary_search");
    expect(findPrimaryArray2DBinding(trace)).toBeUndefined();
  });
});

describe("computeArray2DView", () => {
  it("renders every row the same width and flags a real changed cell", () => {
    const { trace } = loadFixture("dp_knapsack");
    const binding = findPrimaryArray2DBinding(trace)!;
    // Not the trace's final step: `table` is a local that goes out of
    // scope (and out of the heap snapshot) once `knapsack` returns — this
    // reads it while the function is still on the stack.
    const step = getStateAt(trace, 100);
    const view = computeArray2DView(step, binding);

    expect(view).not.toBeNull();
    expect(view!.rows.length).toBeGreaterThan(0);
    const width = view!.rows[0]!.length;
    expect(view!.rows.every((row) => row.length === width)).toBe(true);
  });
});
