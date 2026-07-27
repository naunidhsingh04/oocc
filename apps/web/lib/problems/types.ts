import type { FixtureName } from "@/lib/fixtures";

export type Difficulty = "easy" | "medium" | "hard";
export type ProblemStatus = "solved" | "attempted" | "todo";

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Problem {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  /** 0-100, static/seed data — no submissions table exists yet (Phase 5). */
  acceptance: number;
  status: ProblemStatus;
  statementMd: string;
  /** The fixture backing the Python starter code + "Run" result — always a
   * real committed trace, never fabricated output. */
  fixturePython: FixtureName;
  fixtureCpp?: FixtureName;
  starterPython: string;
  starterCpp?: string;
  testCases: TestCase[];
  /** Only set for the one problem with a real generated buggy/correct
   * submission pair (see lib/problems/data/binary-search-submission.json)
   * — used to demonstrate the failing-submission -> Visualize flow with
   * genuine trace data instead of a fabricated example. */
  hasSubmissionDemo?: boolean;
}
