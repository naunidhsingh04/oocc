import { describe, expect, it } from "vitest";
import { getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { computeSuggestedQuestions } from "./suggestedQuestions";

describe("computeSuggestedQuestions", () => {
  it("returns nothing for a step-less state", () => {
    expect(computeSuggestedQuestions({ step: undefined, algorithm: null, insights: [] })).toEqual([]);
  });

  it("generates questions grounded in the current step's own locals", () => {
    const { trace } = loadFixture("binary_search");
    const step = getStateAt(trace, 16)!; // a real step with lo/hi/mid locals
    const questions = computeSuggestedQuestions({ step, algorithm: null, insights: [] });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(4);
  });

  it("changes as the step changes (never a hardcoded list)", () => {
    const { trace } = loadFixture("binary_search");
    const early = computeSuggestedQuestions({ step: getStateAt(trace, 2)!, algorithm: null, insights: [] });
    const later = computeSuggestedQuestions({ step: getStateAt(trace, 20)!, algorithm: null, insights: [] });
    expect(early).not.toEqual(later);
  });

  it("includes an algorithm-aware question once one is classified", () => {
    const { trace } = loadFixture("binary_search");
    const step = getStateAt(trace, 5)!;
    const questions = computeSuggestedQuestions({
      step,
      algorithm: { algorithm: "binary search", family: "searching", confidence: 0.9, evidence_steps: [5] },
      insights: [],
    });
    expect(questions.some((q) => q.includes("binary search"))).toBe(true);
  });
});
