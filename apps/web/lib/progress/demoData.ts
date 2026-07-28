import type { FixtureName } from "@/lib/fixtures";
import type { ProgressRecord } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(now: Date, offsetDays: number): string {
  return new Date(now.getTime() + offsetDays * DAY_MS).toISOString();
}

/**
 * Demo progress data — shown only when `GET /api/progress` doesn't return
 * real data (no session cookie in this dev sandbox, or a network failure;
 * see `lib/progress/api.ts`), and always labeled as demo by whichever
 * component renders it (`ProgressDashboard`'s `isDemo` flag) — never
 * presented as if it were the signed-in learner's own numbers.
 *
 * Timestamps are computed relative to `now` (not hardcoded) so "due for
 * review" stays true no matter when this is actually viewed. Deliberately
 * covers only 7 of the 12 concepts, mixing overdue/weak/solid/untouched —
 * the concept graph still renders all 12 (untouched ones at empty fill),
 * exactly like a real learner's partial progress would look.
 */
export function buildDemoProgressRecords(now: Date = new Date()): ProgressRecord[] {
  return [
    { concept_id: "bubble-sort", mastery: 0.91, last_seen_at: iso(now, -30), next_review_at: iso(now, -5) },
    { concept_id: "bfs", mastery: 0.15, last_seen_at: iso(now, -4), next_review_at: iso(now, -3) },
    { concept_id: "recursion", mastery: 0.45, last_seen_at: iso(now, -3), next_review_at: iso(now, -1) },
    { concept_id: "hash-maps", mastery: 0.3, last_seen_at: iso(now, -1), next_review_at: iso(now, -0.2) },
    { concept_id: "call-stacks", mastery: 0.65, last_seen_at: iso(now, -5), next_review_at: iso(now, 10) },
    { concept_id: "quicksort", mastery: 0.55, last_seen_at: iso(now, -1), next_review_at: iso(now, 3) },
    { concept_id: "binary-search", mastery: 0.82, last_seen_at: iso(now, -10), next_review_at: iso(now, 20) },
  ];
}

export interface DemoRunEntry {
  id: string;
  label: string;
  fixture: FixtureName;
  timestamp: string;
}

/** Demo run history — real committed fixtures (never fabricated trace
 * data), lazily loaded by `RunHistory.tsx` the same way
 * `EmbeddedTrace`/`MiniRibbon` already load fixtures for curriculum
 * articles. Shown only when there's no real (localStorage) run history yet
 * — see `lib/progress/runHistory.ts`. */
export function buildDemoRunEntries(now: Date = new Date()): DemoRunEntry[] {
  const specs: Array<{ id: string; fixture: FixtureName; offsetDays: number }> = [
    { id: "demo-1", fixture: "quicksort_partition", offsetDays: -1 },
    { id: "demo-2", fixture: "bfs_graph", offsetDays: -2 },
    { id: "demo-3", fixture: "binary_search", offsetDays: -4 },
    { id: "demo-4", fixture: "bubble_sort", offsetDays: -6 },
  ];
  return specs.map((spec) => ({
    id: spec.id,
    label: spec.fixture,
    fixture: spec.fixture,
    timestamp: iso(now, spec.offsetDays),
  }));
}
