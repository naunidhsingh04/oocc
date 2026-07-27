/**
 * Shapes returned by the real FastAPI backend's LLM-touching fields
 * (apps/api/app/routers/runs.py, tutor.py, settings.py) — not part of
 * `@oocc/contracts` because these are Phase 3's non-deterministic,
 * per-request outputs, never a versioned/shared trace-adjacent contract.
 */

export interface AlgorithmResult {
  algorithm: string;
  family: string;
  confidence: number;
  evidence_steps: number[];
}

export interface StepRangeNarration {
  step_range: [number, number];
  summary: string;
}

export interface RunNarration {
  insights: Array<string | null>;
  complexity: { explanation: string; dominant_operation: string } | null;
  plan_summary: string | null;
  step_ranges: StepRangeNarration[];
}

export interface Capabilities {
  tutor: boolean;
  narration: boolean;
}

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
}

export type TutorEvent =
  | { type: "unavailable"; reason: "no_provider_key" }
  | { type: "chunk"; text: string }
  | { type: "done"; step_refs: number[]; degraded: boolean; tokens_used: number | null };

export interface ValidateKeyResult {
  valid: boolean;
  tokens_used: number | null;
  error: string | null;
}
