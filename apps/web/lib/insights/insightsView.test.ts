import { describe, expect, it } from "vitest";
import { loadFixture } from "@/lib/player/testHelpers";
import {
  computeInsightsByLine,
  groupInsightsBySeverity,
  lineForStepRef,
  strongestSeverity,
} from "./insightsView";

describe("lineForStepRef", () => {
  it("finds the source line for a real step index", () => {
    const { trace } = loadFixture("binary_search");
    const line = lineForStepRef(trace, trace.steps[3]!.i);
    expect(line).toBe(trace.steps[3]!.line);
  });

  it("returns null for a step index absent from the trace", () => {
    const { trace } = loadFixture("binary_search");
    expect(lineForStepRef(trace, 999_999)).toBeNull();
  });
});

describe("computeInsightsByLine", () => {
  it("maps two_sum's accidental_quadratic finding to a real source line", () => {
    const { trace } = loadFixture("two_sum");
    const insight = {
      kind: "accidental_quadratic" as const,
      severity: "warning" as const,
      step_refs: [trace.steps[8]!.i],
      detail: "`in` on a container inside a loop",
    };
    const byLine = computeInsightsByLine(trace, [insight]);
    expect(byLine.get(trace.steps[8]!.line)).toEqual([insight]);
  });
});

describe("groupInsightsBySeverity and strongestSeverity", () => {
  const insights = [
    { kind: "dead_variable" as const, severity: "info" as const, step_refs: [1] },
    { kind: "accidental_quadratic" as const, severity: "warning" as const, step_refs: [2] },
    { kind: "off_by_one" as const, severity: "error" as const, step_refs: [3] },
  ];

  it("buckets findings by severity and pairs narrations positionally", () => {
    const groups = groupInsightsBySeverity(insights, [null, "narrated", null]);
    expect(groups.error).toHaveLength(1);
    expect(groups.warning[0]?.narration).toBe("narrated");
    expect(groups.info).toHaveLength(1);
  });

  it("picks the most severe finding on a line with several", () => {
    expect(strongestSeverity(insights)).toBe("error");
    expect(strongestSeverity([insights[0]!])).toBe("info");
  });
});
