import type { Analysis, Trace, VizPlan } from "@oocc/contracts";

/**
 * The twelve committed fixtures (docs/PRD.md §2.2, fixtures/README.md).
 * Phase 1 has no backend: this list is the dev-only fixture picker's menu,
 * and also the allowlist the `/api/fixtures/[name]` route validates against
 * before touching the filesystem.
 */
export const FIXTURE_NAMES = [
  "bubble_sort",
  "binary_search",
  "fibonacci_recursion",
  "bfs_graph",
  "linked_list_reversal",
  "two_sum",
  "quicksort_partition",
  "n_queens",
  "dp_knapsack",
  "infinite_loop",
  "throws",
  "large_trace_40k",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export interface FixtureBundle {
  name: FixtureName;
  trace: Trace;
  source: string;
  analysis: Analysis;
  plan: VizPlan;
}

/**
 * Fetches a fixture's trace + source + analysis + plan via the dev-only
 * Next.js route handler. This return shape deliberately matches what
 * `POST /api/runs` returns (apps/api/app/routers/runs.py) — swapping the
 * transport for the real API later is a one-line change in this function,
 * not a shape change at every call site.
 */
export async function fetchFixture(name: FixtureName): Promise<FixtureBundle> {
  const response = await fetch(`/api/fixtures/${name}`);
  if (!response.ok) {
    throw new Error(`Failed to load fixture "${name}": HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    trace: Trace;
    source: string;
    analysis: Analysis;
    plan: VizPlan;
  };
  return { name, trace: data.trace, source: data.source, analysis: data.analysis, plan: data.plan };
}
