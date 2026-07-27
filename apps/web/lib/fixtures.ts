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

/**
 * The Phase 4 C++ fixtures (docs/PRD.md §3.5, fixtures/cpp/) — a second,
 * separate list rather than appended to FIXTURE_NAMES above: that array
 * and fixtures/README.md's "twelve" are the shared, append-only Python
 * set (CLAUDE.md), and this is deliberately not another silent addition
 * to it. `/api/fixtures/[name]` reads these from fixtures/cpp/ instead of
 * fixtures/. Regenerate with fixtures/cpp/generate.py after editing any
 * fixtures/cpp/programs/*.cpp source or the runtime/pass it's compiled
 * against.
 */
export const CPP_FIXTURE_NAMES = [
  "linked_list_reversal_cpp",
  "vector_sort_cpp",
  "bst_insert_cpp",
  "dfs_adjacency_list_cpp",
  "pointer_aliasing_cpp",
  "out_of_bounds_write_cpp",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number] | (typeof CPP_FIXTURE_NAMES)[number];

export function isFixtureName(value: string): value is FixtureName {
  return (
    (FIXTURE_NAMES as readonly string[]).includes(value) || (CPP_FIXTURE_NAMES as readonly string[]).includes(value)
  );
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
