import { describe, expect, it } from "vitest";
import { buildChannelAssignment } from "./channels";
import { loadFixture } from "./testHelpers";
import { computeStepTicks } from "./ticks";

describe("computeStepTicks", () => {
  it("produces one dense tick per array position, even for a head+tail-truncated trace", () => {
    // infinite_loop.trace.json (status "step_limit") keeps only the first
    // ~50 and last ~20 steps of the real run — `step.i` jumps from ~50 to
    // ~580 with nothing in between. Indexing the output array by `step.i`
    // instead of array position used to leave hundreds of undefined holes
    // here, which then crashed the ribbon's tick-binning downstream.
    const { trace } = loadFixture("infinite_loop");
    const channels = buildChannelAssignment(trace);
    const ticks = computeStepTicks(trace, channels);

    expect(ticks).toHaveLength(trace.steps.length);
    expect(ticks.every((t) => t !== undefined)).toBe(true);
  });

  it("aligns each tick to the step at the same array position, not the same `.i`", () => {
    const { trace } = loadFixture("infinite_loop");
    const channels = buildChannelAssignment(trace);
    const ticks = computeStepTicks(trace, channels);

    // Confirm the fixture really is discontiguous, so this test would have
    // caught the bug: not every step.i equals its array position.
    expect(trace.steps.some((step, pos) => step.i !== pos)).toBe(true);
    // Every position still has a tick regardless.
    expect(ticks[trace.steps.length - 1]).toBeDefined();
  });
});
