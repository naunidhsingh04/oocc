/* eslint-disable */
/**
 * AUTO-GENERATED — do not hand-edit.
 * Source: packages/contracts/analysis.schema.json
 * Regenerate with `pnpm gen:contracts` from the repo root.
 */

/**
 * Detected data-structure shapes. A subset of the panel registry (viz-plan.schema.json PanelType) — the structures structure_detector can actually infer from heap shape and access pattern, as opposed to always-available meta-panels like call_stack or console.
 */
export type StructureKind =
  "array" | "array_2d" | "linked_list" | "binary_tree" | "graph" | "stack" | "queue" | "hash_map";
/**
 * The seven deterministic detectors (PRD §4.3 table).
 */
export type InsightKind =
  | "runaway_loop"
  | "off_by_one"
  | "mutation_during_iteration"
  | "accidental_quadratic"
  | "shadowed_builtin"
  | "dead_variable"
  | "redundant_recomputation";
export type Severity = "info" | "warning" | "error";
export type InputShape = "random" | "sorted" | "reverse" | "all_equal";
export type CurveModel = "constant" | "log_n" | "n" | "n_log_n" | "n_squared" | "n_cubed" | "exponential";

/**
 * Phase 2 deterministic analysis output — structure detection, insight scanning, and empirical complexity (docs/PRD.md §4.3). Every field here is produced by rule-based or measurement-based code; none of it may ever be filled in by an LLM (CLAUDE.md "Deterministic means deterministic"). Narration/explanation text is Phase 3's job and is deliberately absent from this schema. Append-only: see trace.schema.json header for the versioning policy.
 */
export interface Analysis {
  structures: DetectedStructure[];
  insights: Insight[];
  /**
   * Null when the executable's primary size-bearing parameter couldn't be confidently identified (PRD §4.3 doesn't require every program to yield a curve, only that the analysis degrades gracefully).
   */
  complexity?: null | ComplexityReport;
}
/**
 * One structure_detector finding, e.g. {kind: "binary_tree", root_ref: "o5", confidence: 0.94} (PRD §4.3).
 */
export interface DetectedStructure {
  kind: StructureKind;
  /**
   * The heap object this structure is rooted at (a tree's root node, a graph's adjacency container, a stack/queue/array's backing list, ...).
   */
  root_ref: string;
  confidence: number;
  /**
   * Optional short, factual (non-narrated) qualifier, e.g. "ambiguous with linked_list".
   */
  note?: string;
}
/**
 * One insight_scanner finding. `detail` is a short factual label (a variable name, a line number) — not narration; Phase 3's narrator turns this into prose.
 */
export interface Insight {
  kind: InsightKind;
  severity: Severity;
  /**
   * Real step indices this finding is evidenced by. Never empty — an insight that can't point at a step isn't a finding.
   */
  step_refs: number[];
  detail?: string;
}
export interface ComplexityReport {
  /**
   * The size-bearing parameter name found by AST analysis, e.g. "arr".
   */
  parameter: string;
  samples: ComplexitySample[];
  fits: CurveFit[];
  best_fit: CurveModel;
}
/**
 * One measured (n, shape) execution, counted via the executor's counters-only mode.
 */
export interface ComplexitySample {
  n: number;
  shape: InputShape;
  step_count: number;
  /**
   * True if this sample hit the counters-only wall-clock/step cap before completing; excluded from curve fitting.
   */
  timed_out?: boolean;
}
/**
 * One candidate model fit against every non-timed-out sample, via least squares on step_count = a * f(n) + b.
 */
export interface CurveFit {
  model: CurveModel;
  r_squared: number;
  coefficients: {
    a: number;
    b: number;
  };
}
