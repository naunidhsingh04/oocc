import { describe, expect, it } from "vitest";
import { ContractValidationError, validateAnalysis, validateTrace, validateVizPlan } from "./validators";

function minimalTrace(): unknown {
  return {
    schema_version: "1.0",
    run_id: "r_abc123",
    language: "python",
    source_hash: `sha256:${"a".repeat(64)}`,
    status: "ok",
    meta: { duration_ms: 1, step_count: 1, truncated: false, stdin: "", peak_heap_objects: 0 },
    steps: [
      {
        i: 0,
        event: "line",
        line: 1,
        func: "<module>",
        depth: 0,
        stack: [{ frame_id: "f0", func: "<module>", line: 1, locals: {} }],
        heap: {},
        stdout_delta: "",
        changed: [],
      },
    ],
  };
}

describe("validateTrace", () => {
  it("accepts a minimal, well-formed trace", () => {
    const trace = validateTrace(minimalTrace());
    expect(trace.run_id).toBe("r_abc123");
    expect(trace.steps[0]?.event).toBe("line");
  });

  it("rejects status=runtime_error with no error object", () => {
    const bad = minimalTrace() as Record<string, unknown>;
    bad.status = "runtime_error";
    expect(() => validateTrace(bad)).toThrow(ContractValidationError);
  });

  it("rejects an event=return step with no `returned`", () => {
    const bad = minimalTrace() as { steps: Array<Record<string, unknown>> };
    bad.steps[0]!.event = "return";
    expect(() => validateTrace(bad)).toThrow(ContractValidationError);
  });

  it("rejects a changed path that doesn't match the grammar", () => {
    const bad = minimalTrace() as { steps: Array<Record<string, unknown>> };
    bad.steps[0]!.changed = ["not a valid path"];
    expect(() => validateTrace(bad)).toThrow(ContractValidationError);
  });

  it("accepts bare null as a Value (the reconciled TreeNode-example encoding)", () => {
    const data = minimalTrace() as { steps: Array<Record<string, unknown>> };
    data.steps[0]!.stack = [
      { frame_id: "f0", func: "<module>", line: 1, locals: { x: null } },
    ];
    expect(() => validateTrace(data)).not.toThrow();
  });
});

describe("validateVizPlan", () => {
  it("accepts a minimal, well-formed viz-plan", () => {
    const plan = validateVizPlan({
      layout: "primary+stack",
      panels: [{ id: "p1", type: "array" }],
    });
    expect(plan.panels[0]?.type).toBe("array");
  });

  it("rejects a panel type outside the registry", () => {
    expect(() =>
      validateVizPlan({
        layout: "primary+stack",
        panels: [{ id: "p1", type: "not_a_real_panel_type" }],
      }),
    ).toThrow(ContractValidationError);
  });

  it("accepts the known pointer/window annotation kinds", () => {
    const plan = validateVizPlan({
      layout: "primary+stack",
      panels: [
        {
          id: "p1",
          type: "array",
          binding: "o1",
          annotations: [
            { kind: "pointer", label: "lo", bind: "frame.lo" },
            { kind: "window", from: "frame.lo", to: "frame.hi" },
          ],
        },
      ],
    });
    expect(plan.panels[0]?.annotations).toHaveLength(2);
  });
});

describe("validateAnalysis", () => {
  it("accepts a minimal, well-formed analysis with null complexity", () => {
    const analysis = validateAnalysis({
      structures: [{ kind: "binary_tree", root_ref: "o5", confidence: 0.94 }],
      insights: [{ kind: "off_by_one", severity: "warning", step_refs: [12, 13] }],
      complexity: null,
    });
    expect(analysis.structures[0]?.kind).toBe("binary_tree");
    expect(analysis.complexity).toBeNull();
  });

  it("accepts a populated complexity report", () => {
    const analysis = validateAnalysis({
      structures: [],
      insights: [],
      complexity: {
        parameter: "arr",
        samples: [{ n: 10, shape: "random", step_count: 42 }],
        fits: [{ model: "n", r_squared: 0.99, coefficients: { a: 1, b: 0 } }],
        best_fit: "n",
      },
    });
    expect(analysis.complexity?.best_fit).toBe("n");
  });

  it("rejects an insight with no step_refs entries required by an unknown kind", () => {
    expect(() =>
      validateAnalysis({
        structures: [],
        insights: [{ kind: "not_a_real_kind", severity: "warning", step_refs: [1] }],
        complexity: null,
      }),
    ).toThrow(ContractValidationError);
  });

  it("rejects a structure kind outside the registry", () => {
    expect(() =>
      validateAnalysis({
        structures: [{ kind: "not_a_real_kind", root_ref: "o1", confidence: 0.5 }],
        insights: [],
        complexity: null,
      }),
    ).toThrow(ContractValidationError);
  });
});
