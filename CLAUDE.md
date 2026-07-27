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

## Tests ship with the code they test

No follow-up PR to "add tests later." If it's worth writing, it's worth a
test in the same change.
