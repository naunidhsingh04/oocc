# CLAUDE.md

Read `docs/PRD.md` in full at the start of every session, before writing
anything. It is the source of truth for every product, architecture, and
design decision in this repo. If something you need isn't in it, ask rather
than inventing it.

Each session covers **one phase** (see PRD §7) and stops at its end. Don't
start Phase N+1 work inside a Phase N session, even if it looks quick.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript strict + Tailwind v4 |
| Design system | packages/ui — Tailwind theme tokens + primitives |
| Contracts | packages/contracts — JSON Schema → Pydantic v2 + TypeScript |
| API | FastAPI + Pydantic v2, structlog |
| Executor | separate service/container — never in the API process |
| Data | Postgres 16 + pgvector, Redis |
| Agents (Phase 3+) | LangGraph, Gemini 2.5 Flash via bring-your-own key |
| JS package manager | pnpm workspaces + Turborepo |
| Python package manager | uv workspace (one shared venv, one `uv.lock`) |

Full rationale: PRD §2.1.

## Folder map

```
oocc/
├─ CLAUDE.md
├─ docs/PRD.md                    source of truth — read every session
├─ packages/
│  ├─ contracts/                  ⚠️ SHARED — see below
│  │  ├─ trace.schema.json        canonical, hand-authored
│  │  ├─ viz-plan.schema.json     canonical, hand-authored
│  │  ├─ analysis.schema.json     canonical, hand-authored — structures/insights/complexity
│  │  ├─ scripts/generate.mjs     pnpm gen:contracts
│  │  ├─ python/src/oocc_contracts/   Pydantic v2 models + validators
│  │  └─ ts/src/                  TypeScript types + validators (@oocc/contracts)
│  └─ ui/                         design tokens + primitives (@oocc/ui)
├─ apps/
│  ├─ web/                        Next.js app — Person A
│  │  ├─ lib/player/              playback store (Zustand) — see below
│  │  ├─ lib/fixtures.ts          the 12 fixture names + dev-only loader
│  │  ├─ lib/panels/              generic, trace-only panel logic (no algorithm knowledge)
│  │  ├─ components/editor/       CodeMirror 6 wrapper
│  │  ├─ components/ribbon/       the Trace Ribbon (canvas)
│  │  ├─ components/panels/       viz panels (array, ... more in Phase 2)
│  │  ├─ components/workspace/    layout, toolbar, playback bar, keyboard shortcuts
│  │  └─ app/api/fixtures/        dev-only — 404s in production, see below
│  └─ api/                        FastAPI app — Person B
│     ├─ app/routers/runs.py      POST /api/runs — see Phase 2 backend below
│     ├─ app/analysis/            structure_detector, insight_scanner,
│     │                           complexity_analyst, viz_planner — all deterministic
│     └─ app/executor_client.py   the only way apps/api ever calls services/executor
├─ services/
│  └─ executor/                   separate container from day one — Person B
│     └─ executor_app/tracer.py   Tracer (full) + CounterTracer (counts-only, fast)
└─ fixtures/                      ⚠️ SHARED — twelve golden traces + generator
   (each fixture also has a committed *.analysis.json and *.plan.json — see
   Phase 2 backend below)
```

## Commands

```sh
# JS/TS (from repo root; turbo fans out across all pnpm packages)
pnpm install
pnpm dev                 # next dev + (Phase 1+) other dev servers
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm gen:contracts       # regenerate packages/contracts/{python,ts}/**/generated
pnpm gen:contracts:check # regenerate + fail if that differs from what's committed

# Python (uv workspace — one venv for apps/api, services/executor,
# packages/contracts/python, fixtures/generator)
uv sync --all-packages
uv run --package oocc-api uvicorn app.main:app --app-dir apps/api --reload
uv run --package oocc-api pytest apps/api/tests
uv run --package oocc-api ruff check apps/api
uv run --package oocc-api mypy apps/api/app
# same pattern for --package oocc-executor, oocc-contracts

# Local stack
docker compose up        # postgres+pgvector, redis, api, executor, web
```

`pnpm gen:contracts:check` is the authority on whether generated contract
code is stale — it's what CI runs. If it fails, run `pnpm gen:contracts` and
commit the diff.

## Shared and append-only: packages/contracts, fixtures/

Both are used by both people every day. **Neither person changes them
alone.** A silent shape change in the trace contract or a fixture breaks
the other person's week — agree on the change first.

`packages/contracts` is additionally **append-only**: once released, never
remove or repurpose an existing field, enum member, or `$defs` entry. Add
new optional fields or enum members only, and bump `schema_version`'s minor
component in the same PR. See `packages/contracts/README.md`.

`packages/contracts/{python,ts}/**/generated` is generated but **committed**
— that's what makes the staleness check possible. Never hand-edit it; run
`pnpm gen:contracts`.

## Deterministic means deterministic

PRD §4 marks specific pipeline nodes as deterministic: `digest`, the
`structure_detector` rule pass, the `complexity_analyst` core (empirical
curve fitting), and every `insight_scanner` detector. **None of these may
ever contain an LLM call.** Only `algorithm_classifier`, the one-paragraph
explanation in `complexity_analyst`, `viz_planner`'s narration, and `tutor`
call the model. This split is what makes the product's claims checkable —
don't blur it for convenience.

## Design refusals (PRD §6)

This must not look like a generic AI website. Refuse, don't soften:

- No gradients (any era's utility naming — `bg-gradient-*`, `bg-linear-*`,
  `bg-radial-*`, `bg-conic-*`, `from-*`/`via-*`/`to-*` stops)
- No glassmorphism / `backdrop-blur`
- No floating orbs
- No cream-and-serif
- No sparkle badges ("✨ Powered by AI" and anything in that register)
- No emoji icons — use a real SVG icon

`packages/ui`'s ESLint rules (`oocc/no-decorative-utilities`,
`oocc/no-emoji-jsx`) enforce the first five and the last mechanically.
They're not the whole list — PRD §6.1–6.6 is.

## Provider keys

A user's `X-Provider-Key` is request-scoped only: never logged, never
stored, never echoed back. Backend code that touches request headers must
not cause the key to reach a log record — see
`apps/api/app/logging.py:bind_sensitive_value` and
`apps/api/tests/test_logging_redaction.py` for the pattern and its test.

## Phase 1 frontend: player, editor, ribbon, array panel (done)

`apps/web` now has a working workspace at `/`, driven entirely by
`fixtures/` — no backend dependency yet. Things later phases must respect:

- **`lib/player/getStateAt.ts`** is the only place components read step
  state from. Nothing else indexes `trace.steps[i]` directly. This is the
  seam PRD §3.4 calls out — Phase 6's keyframe+JSON-Patch wire format
  changes what's inside this function and nothing else.
- **`lib/player/channels.ts`** assigns every variable name a channel (1-8)
  once, in first-appearance order across the whole trace, at `loadTrace`
  time. Every panel that shows a variable imports this module rather than
  computing its own colors — that's what keeps one variable one color
  everywhere.
- **`components/ribbon/`** bins ticks into pixel columns once per
  resize/trace-load (`tickBins.ts`), never per frame — that's what holds
  60fps on `large_trace_40k`. Loop brackets are detected from the step
  trace alone (`lib/player/loops.ts`), no digest/AST needed.
- **`components/panels/ArrayPanel.tsx`** and `lib/panels/arrayDetection.ts`
  contain zero algorithm-specific logic — no fixture name, no sorting
  knowledge. It works off `changed` and frame locals generically. Keep it
  that way; the twelve fixtures are exactly what enforce this from outside.
- **`app/api/fixtures/`** is a dev-only stand-in for Phase 2's real run API
  (404s when `NODE_ENV=production`). Don't build on it as if it were a real
  surface — replace it, don't extend it, when the run API lands.
- **Full-height layout gotcha**: the app shell root must be `h-dvh`, not
  `min-h-dvh` — `react-resizable-panels`' `Group` (and anything else using
  `h-full`) needs a *definite* ancestor height to resolve percentages
  against; a `min-height`-only root makes every nested `h-full` silently
  collapse to content size instead of filling the viewport. Every new panel
  root also needs an explicit height/flex chain down to its content (see
  `ArrayPanel.tsx`'s `Tabs`/`Panel` classNames) — a plain wrapper `<div>` in
  the middle breaks the chain even when everything around it is correct.

## Phase 2 backend: the deterministic analysis layer (done)

`POST /api/runs` (`apps/api/app/routers/runs.py`) now runs a program through
`services/executor` and returns `{trace, analysis, plan}` — no LLM call
anywhere on this path; see "Deterministic means deterministic" above.
Things later phases must respect:

- **`services/executor/executor_app/tracer.py`** now has two tracers:
  `Tracer` (full frame/heap capture, unchanged) and `CounterTracer` (LINE
  event only, no snapshotting — step counts only, ~10x less overhead).
  `complexity_analyst` is the only caller of `CounterTracer`, via
  `POST /execute/counters`; everything else uses `Tracer` via `POST /execute`.
- **`app/analysis/structure_detector.py`** classifies by heap shape and
  access pattern only — never by variable or class name. It merges heap
  snapshots across all steps (last-seen wins), builds a pointer graph
  per-type to tell binary trees from linked lists (in-degree + cycle
  detection), and infers stack/queue purely from which end of a list grows
  and shrinks over time. **Gotcha**: a list transition through length 0
  (0→1 or 1→0 elements) is positionally ambiguous — both "grew at the
  front" and "grew at the end" checks match simultaneously — and must be
  skipped rather than classified; `insight_scanner`'s
  `_detect_accidental_quadratic` has the identical guard for the identical
  reason. Don't remove either without re-checking `bfs_graph`'s `order`
  list and its real queue, which regression-test this exact case.
- **`app/analysis/complexity_analyst.py`** fits against the **worst-observed
  step count per `n`** across all four input shapes, never all shapes
  pooled into one regression — an algorithm with a legitimate best-case
  shortcut (bubble sort's early exit on sorted input) runs asymptotically
  faster on some shapes without changing its complexity class, and pooling
  corrupts the fit. All raw samples are still returned for the frontend's
  scatter plot; only the fit uses the worst-case series.
- **`app/analysis/ast_inspect.py`'s `find_size_parameter`** scans not just
  the primary function's own body but every top-level sibling function too
  — needed because a function like `quicksort` never indexes its array
  itself, only the `partition` helper it delegates to does, under the same
  parameter name.
- **`app/analysis/insight_scanner.py`'s `_detect_runaway_loop`** treats
  hitting the tracer's own step/wall-clock cap as sufficient evidence by
  itself — a "stuck local" is additional detail, not a gate, because a
  genuinely infinite loop that keeps incrementing a counter forever
  (`while True: i += 1`) has no stuck value to point at but is exactly as
  much of a bug.
- **`app/analysis/viz_planner.py`** maps each detected structure straight to
  the panel type of the same name (`StructureKind` is already a subset of
  the panel registry), always adds `call_stack` + `variables`, and adds
  `recursion_tree`/`console` only when the trace shows recursion/stdout.
  Plans are cached by `source_hash` in a process-local, size-capped dict —
  promoting this to the shared Redis cache from PRD §4.4 is future infra
  work, not a behavior change.
- **`fixtures/generator/generate_analysis.py`** (new, alongside `run_all.py`)
  reads the committed `*.trace.json` files and runs them through the real
  `apps/api` analysis modules (imported directly, not over HTTP — this
  script has no running executor service, so it calls `CounterTracer`
  in-process for `complexity_analyst`) to produce the committed
  `*.analysis.json` / `*.plan.json` per fixture. Re-run it after `run_all.py`
  any time a fixture's trace or a detector's logic changes.

## Phase 2 frontend: the panel registry and layout engine (done)

`apps/web` now mounts a full multi-panel workspace from viz_planner's plan
instead of Phase 1's single hardcoded `ArrayPanel`. Things later phases
must respect:

- **The panel contract** (`components/panels/types.ts`'s `VizPanelProps`):
  every panel takes one optional prop, `panel` (a viz-plan `Panel` node —
  `id`/`type`/`binding?`/`role?`/`annotations?`). Panels never take trace
  data as a prop; they read `usePlayerStore` directly for `trace`,
  `channels`, and the current step via `getStateAt`, exactly like Phase 1's
  `ArrayPanel`. When `panel.binding` is absent (a panel rendered standalone,
  e.g. in a test or the styleguide) every panel falls back to
  auto-detecting its own binding generically, the same rule Phase 1
  established — no fixture name, no algorithm knowledge, ever, in any
  `lib/panels/*Detection.ts` module.
- **`components/workspace/panelRegistry.ts`** is the single source of truth
  mapping every `PanelType` (from `@oocc/contracts`) to its component.
  `resolvePanelComponent` falls back to `GenericPanel` (a grey opaque chip,
  PRD §3.2's own "unknown → opaque" rule applied one level up) for any type
  not in the map — a plan panel with a hallucinated type degrades instead
  of crashing the layout engine.
- **`components/workspace/PanelGrid.tsx` + `usePanelArrangement.ts`** are
  the layout engine: they seed the working panel list from the plan, apply
  add/remove/retype on top, and persist the result to `localStorage` keyed
  by `storageKey` (today: `fixtureName ?? trace.source_hash`). Switching to
  a different run re-seeds from *that* run's own plan; it never carries an
  old run's arrangement forward. `layout: "primary+stack"` renders
  literally as a primary column + a stacked column of the rest; any other
  string (today just `"meta"`) renders as one flat stack.
- **`components/panels/GraphPanel.tsx` / `lib/panels/graphDetection.ts`**
  and **`HeapObjectsPanel.tsx` / `heapObjectsDetection.ts`** compute their
  d3-force layout once per `(trace, binding)` — memoized on the trace
  object, never on the current step — and freeze it; only visited-node/
  traversed-edge highlighting (accumulated **cumulatively** up to the
  current step, not flashed per-step) changes during playback. **Gotcha**:
  d3-force's `forceLink` mutates its input link objects in place, replacing
  `source`/`target` string ids with resolved node object references — pass
  it a throwaway copy of your edges array, never the array you're about to
  return, or every downstream `nodes.find(n => n.id === edge.source)`
  lookup silently starts comparing a string to an object and returns
  `undefined`. `graphDetection.test.ts` regression-tests this exact bug.
- **`lib/player/ticks.ts`'s `computeStepTicks`** indexes its output array
  by **array position**, never by `step.i`. A head+tail-sampled truncated
  trace (`infinite_loop`, `status: "step_limit"`) keeps steps whose `.i`
  jumps from ~50 to ~580 with nothing in between; indexing by `.i` instead
  of position leaves hundreds of holes and desyncs the array's own
  `.length` from `trace.steps.length`, which crashed the ribbon's
  `computeTickBins` downstream the moment a truncated trace was scrubbed.
  This was a Phase 1 bug, found and fixed here because it directly broke
  Phase 2's own "every fixture visualizes without a crash" bar — see
  `ticks.test.ts` for the regression test.
- **`components/panels/TimelinePanel.tsx`** and the ribbon are the only
  canvas-based panels; every other panel is plain DOM/SVG because none of
  the twelve fixtures produce enough concurrent elements for that to cost
  anything (profiled before reaching for canvas, per the phase brief —
  see below). `lib/panels/variablesDetection.ts`'s `computeVariableHistories`
  (which Timeline also reuses) downsamples every variable's numeric history
  to ≤40 points and is memoized on `trace` alone, not per step.
- **Performance**: profiled first, as instructed — the actual bottleneck
  on `large_trace_40k` was never frame cost (every panel's expensive
  per-trace computation is already `useMemo`'d on `trace` alone, so replay
  only re-renders cheap, current-step-sized data), it was the correctness
  bug above. Verified via a scripted 4x-speed playback: real steps advanced
  in lockstep with wall-clock time and zero console/page errors across a
  full pass of all twelve fixtures.
- **The complexity panel** (`components/panels/ComplexityPanel.tsx`,
  `lib/panels/complexityView.ts`) has no `PanelType` — `complexity_analyst`'s
  output has no heap binding to mount from — so it's a fixed pane in
  `Workspace.tsx`, shown whenever `analysis.complexity` is non-null,
  alongside the plan-driven `PanelGrid` rather than inside it.
- **`app/api/fixtures/[name]/route.ts`** (dev-only, still 404s in
  production) now also serves each fixture's committed `*.analysis.json`
  and `*.plan.json`. `lib/fixtures.ts`'s `FixtureBundle` shape deliberately
  matches `POST /api/runs`'s real response shape — swapping the transport
  for the live API later is a one-line change in `fetchFixture`, not a
  shape change at every call site.

## Tests ship with the code they test

No follow-up PR to "add tests later." If it's worth writing, it's worth a
test in the same change.
