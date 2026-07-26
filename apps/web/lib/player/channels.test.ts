import { describe, expect, it } from "vitest";
import { buildChannelAssignment, CHANNEL_COUNT } from "./channels";
import { loadFixture } from "./testHelpers";

describe("buildChannelAssignment", () => {
  it("assigns channels in first-appearance order and is stable across calls", () => {
    const { trace } = loadFixture("binary_search");
    const a = buildChannelAssignment(trace);
    const b = buildChannelAssignment(trace);
    expect([...a.entries()]).toEqual([...b.entries()]);

    // <module> binds the function object itself, then `arr`, then
    // `target`, all before binary_search's own frame runs — first
    // appearance order across the whole trace, not per-frame.
    expect(a.get("binary_search")).toBe(1);
    expect(a.get("arr")).toBe(2);
    expect(a.get("target")).toBe(3);
  });

  it("cycles round-robin once more than CHANNEL_COUNT distinct names appear", () => {
    const { trace } = loadFixture("n_queens");
    const assignment = buildChannelAssignment(trace);
    const names = [...assignment.keys()];
    expect(names.length).toBeGreaterThan(CHANNEL_COUNT);
    // The 9th distinct variable wraps back around to channel 1.
    expect(assignment.get(names[CHANNEL_COUNT]!)).toBe(1);
  });

  it("gives every channel value in [1, CHANNEL_COUNT]", () => {
    const { trace } = loadFixture("dp_knapsack");
    const assignment = buildChannelAssignment(trace);
    for (const channel of assignment.values()) {
      expect(channel).toBeGreaterThanOrEqual(1);
      expect(channel).toBeLessThanOrEqual(CHANNEL_COUNT);
    }
  });
});
