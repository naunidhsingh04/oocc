import { describe, expect, it } from "vitest";
import { isWeakConcept, masteryFillRatio, masteryPercentLabel } from "./mastery";

describe("masteryFillRatio", () => {
  it("clamps to [MIN_FILL, 1]", () => {
    expect(masteryFillRatio(0)).toBeGreaterThan(0);
    expect(masteryFillRatio(1)).toBe(1);
  });

  it("is monotonically increasing in mastery", () => {
    const a = masteryFillRatio(0.2);
    const b = masteryFillRatio(0.6);
    const c = masteryFillRatio(0.9);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("clamps out-of-range and NaN input", () => {
    expect(masteryFillRatio(-5)).toBe(masteryFillRatio(0));
    expect(masteryFillRatio(5)).toBe(1);
    expect(masteryFillRatio(NaN)).toBe(masteryFillRatio(0));
  });
});

describe("masteryPercentLabel", () => {
  it("rounds to a whole percent", () => {
    expect(masteryPercentLabel(0.826)).toBe("83%");
    expect(masteryPercentLabel(0)).toBe("0%");
    expect(masteryPercentLabel(1)).toBe("100%");
  });
});

describe("isWeakConcept", () => {
  it("is true strictly below the threshold", () => {
    expect(isWeakConcept(0.49)).toBe(true);
    expect(isWeakConcept(0.5)).toBe(false);
    expect(isWeakConcept(0.9)).toBe(false);
  });
});
