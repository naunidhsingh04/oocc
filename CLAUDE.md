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
| C++ engine (Phase 4+) | libclang source-to-source pass → wasi-sdk → WASM — see Phase 4 backend below |
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
│  │  ├─ lib/fixtures.ts          the 12 Python + 6 C++ fixture names + dev-only loader
│  │  ├─ lib/panels/              generic, trace-only panel logic (no algorithm knowledge)
│  │  ├─ lib/api/                 the real FastAPI backend client — see Phase 3 frontend below
│  │  ├─ lib/settings/            provider-key storage + validation (Zustand)
│  │  ├─ lib/tutor/               tutor transcript/composer state + suggested questions
│  │  ├─ lib/insights/            insight severity/line-mapping view logic
│  │  ├─ components/editor/       CodeMirror 6 wrapper
│  │  ├─ components/ribbon/       the Trace Ribbon (canvas)
│  │  ├─ components/narration/    labelled segments above the ribbon
│  │  ├─ components/insights/     the severity-grouped findings list
│  │  ├─ components/tutor/        the docked tutor panel
│  │  ├─ components/settings/     the key-setup surface
│  │  ├─ components/panels/       viz panels (array, ... more in Phase 2)
│  │  ├─ components/workspace/    layout, toolbar, playback bar, keyboard shortcuts
│  │  ├─ lib/problems/            static problem seed data + URL-synced list filter/sort state
│  │  ├─ lib/curriculum/          static article seed data + per-instance embedded-trace playback
│  │  ├─ components/problems/     the data table (facets, virtualization, keyboard nav)
│  │  ├─ components/problemWorkspace/  statement + Testcase/Result/Visualize tabs — see Phase 4 frontend below
│  │  ├─ components/curriculum/   EmbeddedTrace/MiniRibbon + the markdown article renderer
│  │  ├─ app/problems/            /problems, /problems/[slug]
│  │  ├─ app/curriculum/          /curriculum, /curriculum/[slug]
│  │  └─ app/api/fixtures/        dev-only — 404s in production, see below
│  └─ api/                        FastAPI app — Person B
│     ├─ app/routers/runs.py      POST /api/runs — see Phase 2 backend below
│     ├─ app/routers/tutor.py     POST /api/tutor (SSE) — see Phase 3 backend below
│     ├─ app/analysis/            structure_detector, insight_scanner,
│     │                           complexity_analyst, viz_planner — all deterministic
│     ├─ app/agents/              the LangGraph pipeline — see Phase 3 backend below
│     ├─ app/tutor/               tutor context assembly + answer validation
│     ├─ app/rag/                 concept_chunks store, embeddings, retrieval
│     ├─ app/security.py          ProviderKey — see Phase 3 backend below
│     ├─ app/cache.py             deterministic-output cache (source_hash -> 7d TTL)
│     ├─ evals/                   insight_scanner eval suite (20 known-bug programs)
│     └─ app/executor_client.py   the only way apps/api ever calls services/executor
├─ services/
│  ├─ executor/                   separate container from day one — Person B
│  │  └─ executor_app/tracer.py   Tracer (full) + CounterTracer (counts-only, fast)
│  └─ cpp-executor/                the C++ engine — see Phase 4 backend below
│     ├─ runtime/                 header-only C++ runtime linked into every instrumented program
│     ├─ cpp_executor/            instrument.py (the pass), toolchain.py, compile_service.py
│     └─ tests/                   native (non-wasm) runtime tests + pass/service pytest suite
├─ fixtures/                      ⚠️ SHARED — twelve golden Python traces + generator
│  (each fixture also has a committed *.analysis.json and *.plan.json — see
│  Phase 2 backend below)
└─ fixtures/cpp/                  six C++ fixtures + generate.py — see Phase 4 backend below
   (a separate, non-shared area — not part of the twelve-fixture set above)
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

## Phase 3 backend: the LangGraph pipeline, tutor, and BYO key (done)

`POST /api/runs` now runs the full pipeline from `app/agents/graph.py`
(digest → {structure_detector, insight_scanner, complexity_analyst,
algorithm_classifier} in parallel → viz_planner → narrator) instead of
calling each analyzer directly, and `POST /api/tutor` (SSE) answers
questions grounded in a real trace. Things later phases must respect:

- **The provider key is the load-bearing constraint of this whole phase**
  (PRD §4.5). `app/security.py`'s `ProviderKey` wraps the raw
  `X-Provider-Key` header in a Pydantic `SecretStr` immediately, and its
  FastAPI dependency (`get_provider_key`) calls
  `app.logging.bind_sensitive_value` on the raw string *before* anything
  else in that request has a chance to log it — including its own return
  value. `configure_logging`'s processor order matters: `format_exc_info`
  must run *before* the redaction processor, or a secret embedded in an
  exception's own message reaches `JSONRenderer` as a live (unscrubbed)
  object instead of text — see `app/main.py`'s global
  `unhandled_exception_handler` and `tests/test_exception_redaction.py`.
  `tests/test_key_never_leaks.py` runs the entire tutor flow with a
  sentinel key and greps the log stream, the SSE response body, every
  prompt actually sent to the (fake) model, and every row in the
  concept-chunk store — this is the gate; if it doesn't pass, nothing else
  in this phase matters.
- **`app/agents/digest.py`** compresses a trace to roughly 2KB: at most 8
  tracked variables (the same channel-count convention the frontend uses)
  with at most 40 downsampled samples each, capped loop-skeleton/call-graph/
  heap-signature/hot-line lists, a 200-char stdout tail. No LLM ever sees a
  raw trace — every agent node downstream reads this instead. The 2KB
  ceiling is only *asserted* against `large_trace_40k` (a busy program with
  many tracked variables can land a bit over — see
  `tests/agents/test_digest.py`'s comment on this tradeoff), but every
  sub-extractor's cap is what keeps it that shape at all.
- **Narration is never merged into a deterministic node's output object.**
  `Insight`, `ComplexityReport`, and `VizPlan` in
  `packages/contracts/{analysis,viz-plan}.schema.json` are all
  `additionalProperties: false` — `Insight`'s own schema docstring already
  says "Phase 3's narrator turns this into prose" as a *separate* artifact.
  `insight_narrator.narrate_insights` returns a list of strings *parallel
  to* `insights`, `complexity_narrator.narrate_complexity` and
  `viz_narrator.narrate_plan` return their own separate values — never
  `{**finding, "narration": ...}`. Breaking this rule means
  `oocc_contracts.validate_analysis` fails on the very next call; this was
  a real bug caught by `tests/test_runs.py` while building this phase, not
  a hypothetical.
- **`app/agents/structure_llm_fallback.py`** only asks the model to
  confirm/reclassify a `kind` for findings below `LOW_CONFIDENCE_THRESHOLD
  = 0.75`, capped at `MAX_RECLASSIFICATIONS = 5` per run — it never touches
  `root_ref`, and a `kind` outside the registry enum is dropped, not
  passed through. `app/analysis/structure_detector.py` itself still never
  imports this module or calls a model; the fallback lives entirely
  downstream, exactly as its own docstring already promised in Phase 2.
- **`app/agents/algorithm_classifier.py`** validates every `evidence_steps`
  entry against the trace's real step indices and retries once with a
  stronger system-prompt suffix on failure; two failed attempts degrade to
  `None`, never a guess. `app/tutor/tutor.py`'s `answer_question` applies
  the identical rule to `step_refs`, plus a deterministic (non-LLM)
  heuristic — `_is_about_the_users_code` — for when an empty `step_refs`
  is legitimately fine (a general concept question) versus something that
  must be retried.
- **`app/routers/tutor.py` is SSE but the model call underneath it isn't
  streaming.** The retry-on-invalid-`step_refs` rule means the server can't
  commit to what the client sees until validation has already passed, so
  `answer_question` runs one (or two) non-streaming structured calls first;
  only the already-validated final answer gets chunked out over
  `text/event-stream`. Don't "fix" this into a raw token stream from the
  model without also solving how a mid-stream response gets un-sent on a
  failed validation.
- **Dependencies that touch Postgres or Redis connect lazily, never at
  dependency-resolution time.** FastAPI resolves every `Depends(...)`
  before the route body runs, even a branch that will never use it (e.g.
  no provider key → the tutor never touches the concept store at all) — so
  `_LazyPostgresConceptStore` (`app/routers/tutor.py`) and
  `_LazyRedisCache` (`app/redis_client.py`) are constructed synchronously
  and only open a real connection the first time one of their methods is
  actually awaited. Skipping this is what broke
  `test_tutor_without_a_key_emits_a_single_unavailable_event` the first
  time this was wired up — the dependency tried to reach Postgres before
  the handler ever got to its own "no key" early return.
- **`app/cache.py`** caches only the deterministic bundle
  (`trace`, `structures`, `insights`, `complexity`, `plan`) by
  `sha256(source + stdin + language)`, 7-day TTL — never
  `algorithm`/narration, which are LLM outputs tied to whichever key the
  caller brought (PRD §4.4's "zero LLM calls" is true because the executor
  run and every deterministic analyzer are skipped on a hit, not because an
  LLM response is reused across users). `run_pipeline_cached`
  (`app/agents/graph.py`) branches on the cache instead of the graph
  itself having a cache-aware node — a hit still runs digest (cheap, pure
  Python, re-derived from the cached trace) and every LLM-only node fresh.
- **`capabilities: {tutor, narration}`** on `POST /api/runs`'s response
  reflects whether *that request* carried a provider key — the frontend
  should use it to render the tutor/narration UI as a quiet affordance up
  front (PRD §4.5), not discover degradation by making a request that's
  going to come back empty.
- **`app/rag/`**: `concept_store.py`'s `ConceptStore` protocol has two
  implementations, `PostgresConceptStore` (real, pgvector `<=>` cosine
  distance) and `InMemoryConceptStore` (fake, cosine similarity in plain
  Python) — every RAG test runs against the fake, since no live Postgres is
  reachable in this dev sandbox (unlike `ExecutorClient`, there's no
  ASGI-transport trick available for a database). `embeddings.py`'s
  `FakeEmbedder` is a deterministic hash-derived unit vector, good for
  testing retrieval *mechanics* (top-k ordering, exact-match similarity)
  but has no notion of real semantic similarity. `seed.py`'s
  `CURRICULUM_SEED` is deliberately small — one short chunk per concept the
  twelve fixtures actually demonstrate; it grows in Phase 4. Migrations are
  one hand-written idempotent SQL file (`migrations/0001_concept_chunks.sql`,
  applied by `scripts/migrate.py`) — no Alembic for one table.
- **`evals/`** is a standalone eval suite, not part of `apps/api/app`:
  twenty programs (`evals/programs/`) each with one deliberately-planted
  bug matching one of `insight_scanner`'s seven detectors
  (`evals/manifest.py` labels each). `evals/run_insight_scanner_eval.py`
  runs them through the *real* `services/executor` tracer (not the
  throwaway fixtures/generator one) and asserts ≥16/20 correctly flagged
  plus zero step index ever cited outside the real trace.
  `tests/evals/test_insight_scanner_eval.py` runs the identical assertions
  as a normal (fast, fully deterministic) test on every push;
  `.github/workflows/nightly-evals.yml` runs the standalone script on a
  schedule for the human-readable report, per the phase brief's explicit
  "run it in CI nightly." **Gotcha found while building the eval set**:
  `_detect_accidental_quadratic`'s static check originally matched `in`
  but not `not in` (identical O(n) cost, equally common — see
  `if v not in seen:`), and once fixed to match both, produced a false
  positive on `bfs_graph`'s `if neighbor not in visited:` where `visited`
  is a `set` (O(1), not a bug) — the fix is `_find_set_valued_names`, a
  module-wide (not scope-aware, deliberately erring toward under- rather
  than over-flagging) scan for names assigned a set literal/comprehension
  or `set(...)` call, excluded from the check.

## Phase 3 frontend: the AI surfaces (done)

`apps/web` now talks to the real FastAPI backend (`lib/api/client.ts`,
`NEXT_PUBLIC_API_URL`) for everything LLM-touching — the tutor, algorithm
badge, and narration — while the trace/analysis/plan themselves keep
coming from the committed fixture (deterministic, byte-stable, no live
backend required just to look at a run). Things later phases must respect:

- **Every AI surface is additive, never a gate.** `usePlayerStore`'s
  `algorithm`/`narration`/`capabilities` fields default to null/empty, and
  `loadRunExtras()` (called automatically after `loadTrace`) is a
  best-effort fetch that degrades to that same empty state on any
  failure — no key, no reachable backend, a 500, all look identical to the
  UI. Nothing about the trace/panels/ribbon/editor depends on this call
  ever succeeding. `capabilities: {tutor, narration}` on the response
  tells panels whether to render their quiet "add a key" state up front,
  instead of discovering it by trying and failing.
- **Zustand selectors must never return a fresh array/object literal.**
  `state.analysis?.insights ?? []` looks harmless but creates a new `[]`
  on every call; `useSyncExternalStore` (what `zustand` is built on)
  compares snapshots by reference, so this reads as "changed every
  render" and is an infinite update loop, not a quiet empty state — hit
  this for real while wiring the insights gutter, composer, and editor
  selectors to the same `analysis.insights ?? []` pattern. Fixed by
  `lib/insights/insightsView.ts`'s exported `EMPTY_INSIGHTS` stable
  reference; the same rule applies to any future selector with a
  fallback default.
- **`step_refs` (from the tutor, insights, narration) are real step `.i`
  values, never array positions** — the same distinction
  `lib/player/ticks.ts` already had to get right for truncated traces.
  `lib/player/getStateAt.ts`'s new `indexForStepRef` is the one place
  that translation happens; `jumpToStepRef` (the player action every
  step-chip/"show me"/narration-segment click calls) wraps it with the
  ribbon pulse too, so all three surfaces scrub identically instead of
  three slightly-different reimplementations.
- **The tutor's SSE stream is genuinely SSE on the wire, but the model
  call underneath it isn't token-streamed** — `apps/api/app/routers/tutor.py`
  runs its retry-on-invalid-`step_refs` logic to completion first, then
  chunks the validated answer out. `lib/api/client.ts`'s
  `streamTutorAnswer` parses `data: {...}\n\n` frames by hand (`fetch` +
  a reader), not `EventSource`, because `EventSource` can't send a POST
  body or the `X-Provider-Key` header.
- **Backtick-quoted identifiers are the JetBrains-Mono-plus-channel-color
  mechanism.** `apps/api/app/tutor/context.py`'s system prompt explicitly
  asks the model to wrap every variable name/value in backticks;
  `components/tutor/MessageContent.tsx` parses those spans, looks the
  identifier up in `channels`, and colors it to match — this is what
  makes "`mid`" in a tutor sentence read as the same `mid` highlighted in
  the array panel. If the system prompt's formatting instruction ever
  changes, this rendering silently stops working (falls back to plain
  monospace, not a crash, but loses the whole point).
- **Selecting code in the editor sets a *pending* selection, not an
  auto-attached chip.** `components/editor/CodeEditor.tsx`'s
  `EditorView.updateListener` writes to `useTutorStore`'s
  `pendingSelection` on every selection change; the composer shows a
  one-click "+ Attach as context" affordance for it. Auto-attaching on
  every selection would spam the composer with chips from incidental
  clicking around the editor.
- **Suggested questions are recomputed from the current step on every
  scrub** (`lib/tutor/suggestedQuestions.ts`), never cached or hardcoded —
  they're deliberately cheap, synchronous, and pure (no LLM call) so
  regenerating on every `currentStep` change is free.
- **The settings panel validates the key against the real backend**
  (`POST /api/settings/validate-key`, `apps/api/app/routers/settings.py`),
  not just a shape check — `lib/settings/providerKey.ts`'s `looksLikeAKey`
  is only a pre-flight guard against spending a network call on obviously
  empty input. Session token count accumulates client-side
  (`useSettingsStore.addTokens`) from every response that reports
  `tokens_used` (validate-key, tutor's `done` event) — there's no
  server-side session to track it against yet (no accounts until Phase 5),
  so it resets on reload by design, not by bug.
- **Backend resilience added in this phase, not Phase 3 backend's
  original scope, but required to make any of this testable without a
  full docker-compose stack**: `app/redis_client.py`'s cache and
  `app/routers/tutor.py`'s RAG retrieval both catch their own connection
  errors and degrade (skip caching / empty curriculum context) rather
  than 500 — a Redis or Postgres outage must never break `POST /api/runs`
  or the tutor. `GeminiClient`/`FakeLLMClient` also gained
  `last_usage_tokens`, surfaced through the tutor's `done` event and the
  validate-key response, for the frontend's session token count.
- **No live Postgres or a real Gemini key in this dev sandbox** — the
  done-criterion ("ask 'why does mid keep landing on 4' on binary_search
  and get a streamed answer whose step chips scrub to steps where the
  claim is visibly true") was verified against the real executor, real
  Redis, and the real SSE/validation/retry pipeline end to end, with only
  the Gemini call itself substituted for a `FakeLLMClient` returning an
  answer double-checked against the real committed trace (`mid` is `4`
  at step 8 and only step 8 in that fixture — the fake answer says
  exactly that, not a made-up claim). Swap in a real key and nothing
  about the request path changes.

## Phase 4 backend: C++ as a second engine (done)

`services/cpp-executor` now compiles C++ to the same trace contract Python
produces — `packages/contracts` did not change. Approach per PRD §3.5:
a source-to-source pass instruments the user's C++, wasi-sdk compiles the
instrumented source to WASM, and (for fixtures/testing in this phase)
Node's built-in WASI runs it; a real browser worker is Phase 4 frontend's
job, not this session's — see "What's deliberately not built yet" below.
Things later phases must respect:

- **libclang Python bindings, not C++ LibTooling.** This sandbox has no
  LLVM/Clang *development* libraries — only Apple's bundled
  `libclang.dylib` — and building full LLVM+Clang via Homebrew is a
  multi-gigabyte, multi-hour compile that didn't fit this session. Every
  doc comment in `services/cpp-executor` calls this out where it matters;
  `instrument.py`'s own module docstring is the canonical explanation.
  libclang's AST cursors + source-range text splicing is the same
  underlying Clang AST, reached through the C API instead of the C++
  wrapper — the instrumented output and everything downstream of it is
  identical either way. If a real LibTooling toolchain ever becomes
  available in this environment, swapping it in only touches
  `instrument.py`; the runtime and every fixture are unaffected.
- **The address table (`oocc_runtime.hpp`)** assigns every `new`/`malloc`
  allocation a stable `oN` id the moment it's made, via a from-scratch
  arena allocator (a 64 MB static array + first-fit free list) rather
  than interposing the platform's real `malloc` — this sidesteps
  fragile cross-libc interposition entirely and gives full control over
  every allocation's address and lifetime. **Two gotchas found building
  this, both now load-bearing comments in the code**: (1) the address
  table's own `std::unordered_map` triggers `operator new` for its node
  storage, which re-enters the same allocator override — an
  `in_bookkeeping()` reentrancy guard (`oocc_runtime.hpp`) stops this from
  infinite-recursing, and also means the runtime's own internal
  allocations (JSON string building, frame bookkeeping) never pollute the
  trace's object-id space or `peak_heap_objects`. (2) `operator delete` is
  overridden globally, so *other* static objects' destructors can invoke
  it during program teardown in an order this TU doesn't control — if the
  address table had already been destructed by then, that's a
  use-after-destruction crash, observed for real. Fixed with a leaked
  placement-new singleton (never `new Arena()` directly, which would
  recursively re-enter the not-yet-initialized singleton through the same
  overridden `operator new` — a static byte buffer + placement-new avoids
  both traps at once).
- **Raw pointers resolve through the address table to `{"ref":"oN"}`
  exactly like a Python reference** (`oocc_trace.hpp`'s `describe_value`
  pointer overload) — this is what lets the linked_list and binary_tree
  panels built in Phase 2 render C++ pointer structures with **zero
  frontend changes**, verified live (see below). A pointer whose target
  isn't tracked (points at a stack primitive, or is dangling) degrades to
  an inline untracked-pointer description rather than fabricating a heap
  object the schema has no type for. A stack-resident container/struct
  *held by value* (not behind a pointer) gets an identity from its own
  address too (`get_or_register_local`, find-or-create rather than
  always-fresh) — same mechanism, so a `std::vector<int> v;` local renders
  as its own heap chip exactly like Python's by-reference model. **Known,
  documented limitation**: that identity is never invalidated when its
  owning frame returns, so a recursive function whose own stack frame
  reuses the same address for a same-shaped container local across two
  unrelated calls at the same depth could inherit the wrong identity —
  none of the six fixtures hit this; see `oocc_engine.hpp`'s file
  docstring for why fixing it properly didn't fit this pass's scope.
- **A block-scoped local's binding is removed when its real C++ scope
  ends, not when its owning function returns.** Found for real during a
  post-implementation bug sweep: `oocc_bind`'s closure captures a variable
  by reference, and this project's function-level-locals model (bindings
  live until the function returns, matching Python) meant a variable
  declared inside a nested `if`/`while`/`for` body kept a dangling
  reference in `f.bindings` for the rest of the function after its block
  exited — confirmed with a native repro (`local` still showing in
  `locals`, with a stale-but-plausible value, at the step *after* its
  `if` block ended) before any fix. `instrument.py` now injects
  `oocc_scope_mark()`/`oocc_unbind_from(mark)` around every nested
  compound statement (not the function's own top-level body, which keeps
  its Python-style whole-function lifetime); a block-scoped variable now
  correctly disappears from `locals` the step after its block ends. Known
  remaining gap: `break`/`continue` skip the block's own closing-brace
  unbind call, so a loop-body-scoped variable can still linger past an
  early loop exit — none of the six fixtures use `break`/`continue`.
- **`decltype(auto)`, not `auto`, for the synthesized return-value local**
  (`instrument.py`'s `_return_replacement`). A function returning a
  reference (`int& foo()`) had its `return expr;` rewritten to
  `{ auto __oocc_rv = (expr); ...; return __oocc_rv; }` — `auto` always
  copies, so this returned a reference to a local about to be destroyed.
  Confirmed for real: clang itself emitted `-Wreturn-stack-address` on the
  generated code, and a reference obtained through the return value no
  longer aliased the original variable. `decltype(auto)` preserves the
  expression's real value category (a reference stays a reference; a
  by-value expression still materializes normally), fixing this with zero
  behavior change for the by-value-return case every fixture actually
  uses.
- **`run_id` is not a `compile_service.compile_source` parameter, and
  nothing about a specific run is baked into the cached wasm at all.** An
  earlier version took `run_id` and threaded it into `instrument()`,
  embedding it in the compiled artifact's `kRunMetaPrefix` constant — on a
  cache hit, the returned bytes were compiled by a *previous* call, so the
  caller's own `run_id` argument was silently ignored. Caught by a
  concurrency test asserting identical output for identical source: two
  threads compiling the same source with different `run_id`s produced
  provably different wasm. Since a compiled artifact is legitimately
  reusable across many logical runs of the same source, `run_id` doesn't
  belong in the compile-time cache key at all — `compile_source` now
  embeds a fixed placeholder, and the executor (whoever actually runs the
  wasm and gets a trace back — `fixtures/cpp/generate.py` today, the
  future browser worker) is responsible for overwriting `trace["run_id"]`
  post-execution, the same way it already computes genuinely per-run
  values like `meta.duration_ms`. The same test also fixed a real (if
  narrower) race: `compile_source` used to write into a hash-derived, not
  per-call-unique, temp filename, so two concurrent cold compiles of the
  same source could corrupt each other's in-flight temp file;
  `tempfile.mkstemp` + `os.replace` (atomic on POSIX) fixes this
  independently of the `run_id` issue above.
- **`changed[]` is built during the same walk that produces the JSON, not
  by re-parsing it afterward.** Every `describe_value`/`describe_object_body`
  call takes a `path` (the ChangedPath grammar — `f1.local`, `oN[i]`,
  `oN.field`, `oN{key}`) and records its own Value fragment into
  `HeapCollector::current_paths` as a side effect, mirroring
  `Tracer._flatten_paths` in the Python engine but computed in lockstep
  with the JSON rather than as a second pass — the two have to stay
  synchronized or the array/heap panels' highlight animations go wrong.
- **The trace's own output channel is fd 1, not a dedicated fd 3.**
  `std::cout` is redirected through a custom `streambuf`
  (`oocc_engine.hpp`'s `CapturingStreambuf`) that buffers into
  `pending_stdout()` instead of writing immediately — real fd 1 is
  therefore never touched by the user's own `std::cout` output, freeing
  it for the trace's single final write. This sidesteps every WASI host
  needing bespoke "open an extra output fd" setup (Node's `node:wasi` has
  no simple way to hand a wasm instance a raw writable fd beyond 0/1/2
  without preopening a directory) — any WASI runtime, including the
  future browser worker shim, already implements fd 1's `fd_write` on day
  one. Raw C stdio (`printf`) isn't captured (a documented scope cut) and
  would race this if a program used it; none of the six fixtures do.
- **A genuine WASM trap can't be caught by the C++ that's trapping** — the
  instance dies immediately with no unwind, so `finalize_and_emit`'s
  normal fd-1 write never runs. Every completed step is therefore *also*
  appended, as it completes, to a flat ND-JSON buffer exposed via two
  explicitly-exported functions, `oocc_trap_buffer_ptr()` /
  `oocc_trap_buffer_len()` (`-Wl,--export=...`, since wasm-ld doesn't
  export arbitrary symbols by default) — a caller that catches the trap
  as a host-level exception can still read this directly out of the dead
  instance's linear memory, which remains valid even after the instance
  itself can no longer execute. Verified for real: the
  `out_of_bounds_write` fixture's `operator[]` walks off the end of a
  3-element vector by 100,000,000 elements, which exceeds the instance's
  current linear memory and traps; `fixtures/cpp/generate.py`'s recovery
  path (the same one a browser worker will use) pulls 8 completed steps
  back out, wraps them in a `status: "runtime_error"` envelope with a
  populated `error` object, and the committed fixture's last step still
  shows the real 3-element vector and the message already printed —
  "land the player on the last good step," achieved. The trap buffer only
  tracks the first `keep_head` (40,000) steps; a trap after that point is
  the rare case of a program running cleanly for tens of thousands of
  steps before finally crashing, and degrades to "somewhere in the head"
  rather than the exact final step.
- **`cursor.extent.*.offset` from libclang is not trustworthy once
  wasi-sysroot's extra `-isystem`/`-resource-dir` parse args are added** —
  reproduced directly: a statement's `.column` correctly pointed at its
  first character while `.offset` pointed 2 bytes past it, consistently,
  across every statement in a file. `.line`/`.column` stayed reliable in
  the same test. `instrument.py`'s `LineIndex` computes every offset from
  `(line, column)` against the source text itself instead — never from
  `.offset` directly — which is the fix, not a workaround layered on top
  of a still-present bug.
- **A `Describer<T>` specialization is spliced in right after its
  struct's own closing `};`, never collected and emitted up front** —
  its `body()` accesses `T`'s fields, so `T` must be fully defined first.
  Emitting all describers before any user code (the first version built)
  is a real compile error, not a hypothetical: `Describer<Node>` accessing
  `Node::val` before `struct Node` exists.
- **STL pretty-printers** (§3.2 heap-type projections, `oocc_stl_printers.hpp`):
  `vector` (incl. the `vector<bool>` bitset-proxy special case), `array`,
  `pair`, `list`, `deque`, `map`, `unordered_map`, `set`, `unordered_set`,
  `optional`, `stack`, `queue`, `priority_queue` — the full §3.5 list.
  `stack`/`queue`/`priority_queue` reach their protected underlying
  container via a derived-class pointer-to-member, the same technique
  GDB's own STL pretty-printers use (no public iteration API otherwise
  exists on a container adaptor). `string` lives in `oocc_trace.hpp`
  itself (inline ≤40 chars, heap `str` object beyond that — same
  threshold as `Tracer.MAX_INLINE_STR_LEN`, for cross-language
  consistency). Anything else degrades to `opaque`, or compiles only if
  the pass generates a `Describer<T>` for it (user structs).
- **Teaching-subset diagnostics** (`instrument.py`'s
  `UNSUPPORTED_CURSOR_KINDS`): lambdas, class templates, and function
  templates are detected at parse time with the exact message text PRD
  §3.5 specifies ("OOCC can't trace lambda expressions yet. This program
  will still compile and run, but without step data.") rather than a
  generic clang parse error. The pass's job stops at detecting and naming
  the construct; `compile_service.py`'s `compile_untraced` is the actual
  fallback — it compiles the user's original, uninstrumented source
  directly (no runtime, no injected calls, so it still runs, just without
  step data), which `compile_source` signals is available via
  `CompileResult.untraced_offer`. Presenting that as an actual offer to a
  user is a frontend concern for a later session.
- **Compilation is cached by `source_hash`** (`compile_service.py`), a
  flat directory keyed by hash — checked before touching clang at all, so
  a cache hit is a single file read, never a subprocess spawn, trivially
  clearing §3.5's "warm ~0ms" target (tested: a warm compile completes in
  well under the test's 500ms bound, a cold one spawns real `clang++`).
  Promoting this to a shared Redis-backed cache (matching
  `apps/api/app/cache.py`'s pattern for the Python deterministic-analysis
  cache) is future infra work once this sits behind a real endpoint, not
  a behavior change — same reasoning `app/cache.py`'s own docstring gives
  for its process-local dict.
- **No CMake.** The teaching subset is always a single translation unit,
  so a single `clang++` invocation (`toolchain.py`'s `compile_to_wasm`)
  does everything CMake would orchestrate for a multi-TU build. Revisit
  if a later phase needs multiple translation units.
- **wasi-sdk has no Homebrew formula** — it's a plain extracted release
  tarball at `.toolchains/wasi-sdk-33.0-arm64-macos/` (gitignored; see
  `services/cpp-executor/README.md` for the exact download command any
  fresh environment needs to run once). `cpp_executor/toolchain.py`
  centralizes every path derived from it so there's exactly one place to
  update if the extracted location or version ever changes.
- **Six fixtures committed** (`fixtures/cpp/`, generated by
  `fixtures/cpp/generate.py`, mirroring `fixtures/generator/`'s role for
  the Python twelve): `linked_list_reversal`, `vector_sort`, `bst_insert`,
  `dfs_adjacency_list`, `pointer_aliasing`, `out_of_bounds_write` (the
  last one committed with `status: "runtime_error"` via the trap-recovery
  path above, not skipped). Each fixture's `.analysis.json`/`.plan.json`
  come from the *same* `structure_detector`/`viz_planner` Python modules
  Phase 2 built — proof by construction that those modules are genuinely
  language-agnostic, since nothing about them changed to accept C++
  traces. `insight_scanner` is skipped for C++ fixtures (`insights: []`)
  since it does Python-`ast`-specific static analysis; a C++-aware
  insight scanner is out of this phase's scope. A separate,
  non-shared area from the twelve-Python-fixture set — see the folder map.
- **Done-criterion verified live, via Playwright screenshots against the
  real dev stack**: `linked_list_reversal_cpp` renders in the *existing*
  `linked_list` panel showing the correctly-reversed `4 → 3 → 2 → 1`
  chain, call stack, and channel-colored variables — with genuinely zero
  changes to any panel or detection component
  (`components/panels/LinkedListPanel.tsx`, `lib/panels/linkedListDetection.ts`
  are untouched). The only frontend edits in this phase are data-layer
  wiring so the existing dev fixture picker can find C++ fixtures at all:
  `lib/fixtures.ts`'s new `CPP_FIXTURE_NAMES` (deliberately a *separate*
  list from the shared, append-only `FIXTURE_NAMES`, not appended to it),
  and `app/api/fixtures/[name]/route.ts` reading from `fixtures/cpp/`
  when a name ends in `_cpp`. `typecheck`/`lint` both pass unchanged.
- **What's deliberately not built yet**: a real browser worker executing
  user-submitted C++ live (not just committed fixtures), the language
  selector UI, and a `POST`-style backend endpoint wrapping
  `compile_service.compile_source` for the frontend to call. This mirrors
  every prior phase's own backend/frontend split (Phase 1–3 each got a
  separate "frontend" session) — `compile_service.py`'s `CompileResult`
  (wasm bytes, diagnostics, `untraced_offer`) is the shape a Phase 4
  frontend session's API layer would wrap, and the six fixtures are
  exactly what CLAUDE.md's own Phase 4 backend brief said they're for:
  "so Person A can wire the language selector immediately."

## Phase 4 frontend: problems, curriculum, and the language selector (done)

`apps/web` now has `/problems` (a dense, faceted, URL-synced, virtualized
data table), `/problems/[slug]` (statement + Testcase/Result/Visualize
tabs around the Phase 1 workspace), and `/curriculum` + `/curriculum/[slug]`
(prose articles with real, scrubbable embedded traces). No live Postgres in
this dev sandbox (same constraint as every earlier phase) — problems and
articles are static seed data (`lib/problems/data.ts`, `lib/curriculum/data.ts`),
mirroring Phase 1's fixture-only precedent rather than waiting on §8's
`problems`/`concepts` tables. Things later phases must respect:

- **The failing-submission demo is real, not scripted.** `lib/problems/data/binary-search-submission.json`
  is generated by actually running both a correct and a deliberately-buggy
  (`lo < hi` instead of `lo <= hi`) binary search through
  `services/executor`'s own `Tracer` — the exact same tracer Phase 2
  backend built, called directly, not reimplemented. The JSON records real
  stdout for both, and a **computed** divergence step (the first array
  position where the buggy trace's locals disagree with the correct
  trace's at the same index), not a hand-picked one. `binary-search`'s
  starter code in `lib/problems/data.ts` is deliberately the buggy variant
  so the editor and the Visualize tab never disagree about what "ran."
  Every other problem's "Submit" replays its own already-committed fixture
  trace and always passes — honest about what's actually live right now
  (no run pipeline for edited code exists yet; that's Phase 5's `runs`
  table and a real submission endpoint).
- **`ResultPanel`'s "Visualize where it went wrong" is the one-click path
  the whole phase brief centers on**: it loads the buggy trace into
  `usePlayerStore` and calls `jumpToStepRef(divergenceStepI)` *before*
  switching tabs, so by the time the Visualize tab mounts (Radix
  `Tabs.Content` unmounts inactive panels by default — confirmed, not
  fought), the store is already scrubbed to the right step. Verified live
  via Playwright: submitting binary-search's buggy starter shows "0/2
  passed" with a real expected/actual diff, and clicking through lands the
  ribbon at step 17/23, line 11 (`return -1`) — the exact statement that
  produces the wrong answer.
- **`EmbeddedTrace` (`components/curriculum/EmbeddedTrace.tsx`) is
  deliberately NOT built on `usePlayerStore`.** That store is a
  page-wide singleton; a curriculum article can embed many live traces on
  one page (one per code block), each needing independent playback state.
  `lib/curriculum/useEmbeddedTrace.ts` is a per-instance hook reusing the
  exact same pure computation utilities the real store does
  (`buildChannelAssignment`, `computeStepTicks`) so an embedded trace's
  channel colors and ribbon ticks are pixel-identical to the same trace
  opened in the full workspace — only playback position is local. "Expand
  to workspace" is the *only* place an embedded trace touches the global
  store: it calls `loadTrace` once and navigates to `/`.
- **`MiniRibbon` reuses the real ribbon's drawing primitives**
  (`drawRibbon`, `computeTickBins`, `readRibbonColors` from
  `components/ribbon/`) rather than reimplementing tick rendering — a
  second, drifting ribbon implementation was the obvious way this
  quietly stops matching the real one after the next ribbon change.
- **A fenced code block tagged ` ```trace:<fixtureName> ` renders as a
  live `EmbeddedTrace`; every other fence renders as ordinary code** —
  `components/curriculum/ArticleBody.tsx`'s `code` component override on
  `react-markdown`. Two real bugs found building this, both structural,
  neither visually obvious until inspected: (1) `react-markdown` always
  wraps a fenced block's `code` node in its own `pre` node regardless of
  what the `code` override renders, so `EmbeddedTrace` (and the "unknown
  fixture" error box) ended up nested inside a browser-default `<pre>` —
  it still *looked* right, verified live, but was invalid `pre > div >
  pre` nesting; fixed by overriding `pre` itself as a bare passthrough
  fragment and letting `code` decide when a real `<pre>` is actually
  warranted (only genuine static fenced blocks). (2) spreading
  `react-markdown`'s own `code` props (`{...rest}`) onto a real `<code>`
  element put a literal `node="[object Object]"` attribute in the
  rendered HTML — `node` is react-markdown's AST-node prop, never a valid
  DOM attribute; fixed by only ever destructuring `className`/`children`
  explicitly, never spreading the rest.
- **The language selector is a `CodeMirror` `Compartment`, not a
  view remount.** `components/editor/CodeEditor.tsx` now reconfigures a
  `Compartment` between `python()`/`cpp()` (new `@codemirror/lang-cpp`
  dependency) keyed off `trace.language`, reused by both the main
  workspace and the problem workspace — one editor implementation, not
  two. A full `EditorView` remount on language change would silently
  discard undo history and scroll position; a compartment reconfigure
  doesn't. The quiet engine indicator PRD asks for lives in
  `components/workspace/Toolbar.tsx`, next to the fixture chip, same
  size/weight as everything else there — never louder.
- **The problem list's virtualization is real**, not just wired for show:
  `@tanstack/react-virtual` (new dependency) mounts only the visible row
  window; sort/filter/search state lives entirely in the URL
  (`lib/problems/listState.ts`'s `parseListState`/`serializeListState`,
  tested round-trip) via `router.replace` — never component state — so a
  reload, share, or back-button press all reproduce the exact view.
  Keyboard nav (`j`/`k`/arrow keys + `Enter`) moves a focused-row ring
  independent of hover.
- **A real, if narrow, bug found and fixed by manual verification, not
  code review alone**: the dev-only `FixturePicker`'s `<select>` used
  `fixtureName ?? ""` as its controlled value — once traces could be
  loaded from problems/articles with a `fixtureName` that isn't one of
  the picker's own `<option>` values (e.g. the problem slug
  `"binary-search"`), the browser silently coerced the unmatched value to
  whichever `<option>` happened to be first, so the picker displayed the
  *wrong* fixture as selected. Fixed by falling back to `""` unless
  `fixtureName` is actually one of the picker's own valid options
  (`isFixtureName` guard).
- **Data integrity is tested, not just eyeballed**: `lib/problems/data.test.ts`
  and `lib/curriculum/data.test.ts` assert every `fixturePython`/
  `fixtureCpp`/embedded-trace-fence reference across all 13 problems and
  12 articles resolves to a real committed fixture, every slug is unique,
  and every internal `relatedSlugs`/markdown link points at a real
  article — the exact class of typo that would otherwise only surface as
  a silent blank panel at runtime. All three fenced-trace/interlink/
  fixture-reference checks passed on the first real run once the actual
  typos (none, as it turned out) would have been caught.
- **Twelve curriculum articles, thirteen problems** — both static seed
  data, both mixing Python and C++ fixtures (four articles and four
  problems are C++-only or C++-companion, exercising the Phase 4 backend
  engine's fixtures the same way the Python ones exercise Phase 1–3's).
  Deep interlinking is bidirectional by convention (if A lists B in
  `relatedSlugs`, B lists A back) and rendered as a "Related concepts"
  rail at the bottom of every article, plus inline markdown links inside
  the prose itself.
- **Done-criteria verified live, via Playwright against the real dev
  stack**: submitting the (deliberately buggy) binary-search starter
  shows a real 0/2-passed result with an expected/actual diff, and
  clicking "Visualize where it went wrong" lands the ribbon at the exact
  step (17/23, `return -1`) the wrong answer is produced. The binary
  search curriculum article's embedded trace scrubs inline via its mini
  ribbon (click-to-seek verified, step counter and channel-colored
  variable chips update live) with an "Expand to workspace" one-click
  escape hatch. All twelve articles load with zero console/page errors.
  `pnpm typecheck` / `lint` / `test` (107 tests) / `build` all pass.

## Tests ship with the code they test

No follow-up PR to "add tests later." If it's worth writing, it's worth a
test in the same change.
