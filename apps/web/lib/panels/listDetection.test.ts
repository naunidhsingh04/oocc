import { getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeListItemsView, findPrimaryListBinding } from "./listDetection";

describe("computeListItemsView", () => {
  it("reads a real list's items and changed indices generically, for stack/queue rendering", () => {
    const { trace } = loadFixture("n_queens");
    const binding = findPrimaryListBinding(trace)!;
    const step = getStateAt(trace, trace.steps.length - 1);
    const view = computeListItemsView(step, binding);

    expect(view).not.toBeNull();
    expect(Array.isArray(view!.values)).toBe(true);
  });

  it("returns null when there's no such list at this step", () => {
    const { trace } = loadFixture("n_queens");
    const step = getStateAt(trace, 0);
    expect(computeListItemsView(step, "o999")).toBeNull();
  });
});
