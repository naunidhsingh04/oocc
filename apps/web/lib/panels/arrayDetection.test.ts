import { describe, expect, it } from "vitest";
import { buildChannelAssignment, getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { computeArrayView, findPrimaryArrayBinding } from "./arrayDetection";

describe("findPrimaryArrayBinding", () => {
  it("finds the sorted array in bubble_sort and quicksort_partition alike, generically", () => {
    for (const name of ["bubble_sort", "quicksort_partition"] as const) {
      const { trace } = loadFixture(name);
      const binding = findPrimaryArrayBinding(trace);
      expect(binding).toBeDefined();
    }
  });
});

describe("computeArrayView", () => {
  it("marks exactly the swapped indices as changed on a real bubble_sort swap step", () => {
    const { trace } = loadFixture("bubble_sort");
    const channels = buildChannelAssignment(trace);
    const binding = findPrimaryArrayBinding(trace)!;
    const step = getStateAt(trace, 10); // a real two-element swap, per fixture inspection
    const view = computeArrayView(step, binding, channels);

    expect(view).not.toBeNull();
    expect(view!.changedIndices).toEqual(new Set([0, 1]));
    expect(view!.values).toHaveLength(6);
    expect(view!.values.every((v) => typeof v === "number")).toBe(true);
  });

  it("derives i/j as index pointers with a window between them, using only locals + array length", () => {
    const { trace } = loadFixture("bubble_sort");
    const channels = buildChannelAssignment(trace);
    const binding = findPrimaryArrayBinding(trace)!;
    const step = getStateAt(trace, 16); // locals: i=0, j=2 — both valid indices into a 6-element array
    const view = computeArrayView(step, binding, channels);

    expect(view).not.toBeNull();
    const names = view!.pointers.map((p) => p.name).sort();
    expect(names).toEqual(["i", "j"]);
    expect(view!.window).not.toBeNull();
    expect(view!.window!.fromIndex).toBe(0);
    expect(view!.window!.toIndex).toBe(2);
  });

  it("animates the same way for quicksort_partition with zero algorithm-specific code", () => {
    const { trace } = loadFixture("quicksort_partition");
    const channels = buildChannelAssignment(trace);
    const binding = findPrimaryArrayBinding(trace)!;

    // Any step once the array exists should produce a valid, renderable view.
    const step = trace.steps.map((_, i) => getStateAt(trace, i)).find((s) => s?.heap[binding]?.type === "list");
    const view = computeArrayView(step, binding, channels);

    expect(view).not.toBeNull();
    expect(Array.isArray(view!.values)).toBe(true);
  });

  it("returns null when the binding has no list at this step (e.g. before it's created)", () => {
    const { trace } = loadFixture("bubble_sort");
    const channels = buildChannelAssignment(trace);
    const step = getStateAt(trace, 0);
    const view = computeArrayView(step, "o999", channels);
    expect(view).toBeNull();
  });
});
