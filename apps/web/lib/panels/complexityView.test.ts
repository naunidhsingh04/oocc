import type { ComplexityReport } from "@oocc/contracts";
import { describe, expect, it } from "vitest";
import { bestFitRSquared, complexityContradiction, fittedCurvePoints, modelLabel, scatterPoints } from "./complexityView";

function report(overrides: Partial<ComplexityReport> = {}): ComplexityReport {
  return {
    parameter: "n",
    samples: [
      { n: 10, shape: "random", step_count: 20 },
      { n: 100, shape: "random", step_count: 200 },
      { n: 1000, shape: "random", step_count: 2000 },
    ],
    fits: [
      { model: "n", r_squared: 0.999, coefficients: { a: 2, b: 0 } },
      { model: "n_log_n", r_squared: 0.95, coefficients: { a: 1, b: 0 } },
      { model: "constant", r_squared: 0.1, coefficients: { a: 0, b: 700 } },
    ],
    best_fit: "n",
    ...overrides,
  };
}

describe("scatterPoints", () => {
  it("excludes timed-out samples", () => {
    const r = report({
      samples: [
        { n: 10, shape: "random", step_count: 20 },
        { n: 1000, shape: "random", step_count: 0, timed_out: true },
      ],
    });
    expect(scatterPoints(r)).toHaveLength(1);
  });
});

describe("fittedCurvePoints", () => {
  it("evaluates the winning model at every measured n", () => {
    const points = fittedCurvePoints(report());
    expect(points.map((p) => p.n)).toEqual([10, 100, 1000]);
    expect(points[0]!.value).toBeCloseTo(20);
    expect(points[2]!.value).toBeCloseTo(2000);
  });
});

describe("bestFitRSquared and modelLabel", () => {
  it("reads the winning model's own R²", () => {
    expect(bestFitRSquared(report())).toBeCloseTo(0.999);
    expect(modelLabel("n")).toBe("O(n)");
    expect(modelLabel("n_squared")).toBe("O(n²)");
  });
});

describe("complexityContradiction", () => {
  it("is silent when one model clearly wins with a strong fit", () => {
    expect(complexityContradiction(report())).toBeNull();
  });

  it("flags a poor best fit", () => {
    const r = report({
      fits: [
        { model: "n", r_squared: 0.6, coefficients: { a: 1, b: 0 } },
        { model: "n_squared", r_squared: 0.55, coefficients: { a: 1, b: 0 } },
      ],
      best_fit: "n",
    });
    expect(complexityContradiction(r)).toMatch(/no model fits cleanly/i);
  });

  it("flags a near-tie between the top two models", () => {
    const r = report({
      fits: [
        { model: "n_log_n", r_squared: 0.97, coefficients: { a: 1, b: 0 } },
        { model: "n", r_squared: 0.96, coefficients: { a: 1, b: 0 } },
      ],
      best_fit: "n_log_n",
    });
    expect(complexityContradiction(r)).toMatch(/close call/i);
  });
});
