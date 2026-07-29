import { describe, expect, it } from "vitest";
import { describeStepForAnnouncement } from "./announceStep";
import { loadFixture } from "./testHelpers";

describe("describeStepForAnnouncement", () => {
  it("returns an empty string for an undefined step", () => {
    expect(describeStepForAnnouncement(undefined, 5)).toBe("");
  });

  it("announces line only when nothing changed", () => {
    const { trace } = loadFixture("binary_search");
    const noChangeStep = trace.steps.find((s) => s.changed.length === 0);
    expect(noChangeStep).toBeDefined();
    const index = trace.steps.indexOf(noChangeStep!);
    expect(describeStepForAnnouncement(noChangeStep, index)).toBe(`Step ${index}, line ${noChangeStep!.line}.`);
  });

  it("announces a local variable change by name and value, matching the real trace", () => {
    const { trace } = loadFixture("binary_search");
    // Step 8 is the real, previously-verified step where `mid` first
    // becomes 4 in this fixture (see Phase 3 backend's tutor done-
    // criterion) — reusing that same well-understood fixture step here
    // instead of a synthetic one.
    const step = trace.steps.find((s) => s.i === 8);
    expect(step).toBeDefined();
    const index = trace.steps.indexOf(step!);
    const announcement = describeStepForAnnouncement(step, index);
    expect(announcement).toBe(`Step ${index}, line ${step!.line}, mid changed to 4.`);
  });

  it("falls back to an event-based announcement when changed[0] isn't a resolvable local", () => {
    // A synthetic step whose changed path doesn't match any local in any
    // frame (e.g. a heap-object path, not `f1.name`) is the real case the
    // event-name fallback exists for.
    const step = {
      i: 4,
      line: 1,
      event: "return",
      func: "binary_search",
      changed: ["o2.field"],
      stack: [{ func: "binary_search", locals: {} }],
    } as unknown as Parameters<typeof describeStepForAnnouncement>[0];
    expect(describeStepForAnnouncement(step, 4)).toBe("Step 4, line 1, returned from binary_search.");
  });
});
