# fixtures/

⚠️ **Shared** — see `CLAUDE.md`. These twelve `*.trace.json` files are what
`apps/web` builds the workspace against before `apps/api` and
`services/executor` exist. Don't change their shape without agreement; a
silent shape change here breaks the other person's week.

## What's here

Twelve real traces (PRD §2.2), each a genuine execution captured by the
throwaway tracer in `generator/`, not hand-written JSON:

| Fixture | Demonstrates |
|---|---|
| `bubble_sort` | in-place swaps, early-exit on no-swap pass |
| `binary_search` | stdin input, the exact `lo`/`hi`/`mid` shape from PRD §3.2 |
| `fibonacci_recursion` | recursion (the "mountain range" depth pattern) |
| `bfs_graph` | queue-as-list, visited-set, adjacency dict |
| `linked_list_reversal` | user-class heap instances (`ListNode`), pointer rewiring |
| `two_sum` | dict-as-hashmap heap encoding |
| `quicksort_partition` | recursion + in-place partitioning |
| `n_queens` | backtracking (append/pop), many failed branches |
| `dp_knapsack` | a growing 2D table (list of lists) |
| `infinite_loop` | **deliberately broken** — `status: "step_limit"`, `truncated: true` |
| `throws` | **deliberately broken** — `status: "runtime_error"`, populated `error` |
| `large_trace_40k` | ~40,000 steps, for scrubber/perf testing at scale |

`infinite_loop` and `throws` are still valid, playable traces — never an
exception. That's the point: a truncated or failed run must render exactly
like a successful one, just with a different `status`.

Since Phase 2, each fixture also has a matching `*.analysis.json`
(structure_detector + insight_scanner + complexity_analyst output, PRD
§4.3's `Analysis` shape) and `*.plan.json` (viz_planner's panel plan) —
the same deterministic pipeline `POST /api/runs` runs at request time, run
once here so `apps/web` can build panels against real shapes without a
running API + executor.

## Regenerating

```sh
uv run --package oocc-fixtures-generator python fixtures/generator/run_all.py
uv run --package oocc-fixtures-generator python fixtures/generator/generate_analysis.py
```

`run_all.py` runs each program in `generator/programs/` under
`generator/tracer.py` (PEP 669 `sys.monitoring`), validates the result
against `packages/contracts/trace.schema.json`, and overwrites the matching
`fixtures/*.trace.json`. It refuses to write anything that doesn't validate
or doesn't match the expected `status` for that fixture.

`generator/` is throwaway: a small, unsandboxed, single-process tracer that
exists only to produce these twelve files. It is **not**
`services/executor` — Phase 1 builds the real sandboxed tracer from scratch
against this same contract.

`generate_analysis.py` reads the already-committed `*.trace.json` files and
runs them through `apps/api`'s real `app.analysis.*` modules (imported
directly, not over HTTP) to produce `*.analysis.json` and `*.plan.json`.
Run it after `run_all.py` any time a fixture's trace or a detector's logic
changes.

## Testing

`packages/contracts/python/tests/test_fixtures.py` validates all twelve
against `trace.schema.json` in CI on every push.
