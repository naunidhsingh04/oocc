import type { Trace } from "@oocc/contracts";

export interface SubmissionCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface SubmissionDemo {
  problemSlug: string;
  correctSource: string;
  buggySource: string;
  /** Real pass/fail + actual output for every test case, computed by
   * actually running both the correct and buggy source through
   * services/executor's Tracer (see the generator script referenced in
   * lib/problems/data/binary-search-submission.json) — never hand-typed. */
  caseResults: SubmissionCaseResult[];
  /** The first failing case's full trace, for the deep Visualize link. */
  input: string;
  buggyTrace: Trace;
  /** Array position (not step.i) into buggyTrace.steps where the buggy
   * run's locals first differ from a correct run's at the same index —
   * a real, computed divergence point, not hand-picked. */
  divergenceStepIndex: number;
  /** The real step.i at that position — what jumpToStepRef needs. */
  divergenceStepI: number;
}

/**
 * Dynamically imported (never a static top-level import) so the ~90KB
 * demo trace bundle only loads for the one problem that has a real
 * generated failing-submission demo, not for every problem page's bundle.
 */
export async function loadSubmissionDemo(slug: string): Promise<SubmissionDemo | null> {
  if (slug === "binary-search") {
    const mod = await import("./data/binary-search-submission.json");
    return mod.default as unknown as SubmissionDemo;
  }
  return null;
}
