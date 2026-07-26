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
├─ services/
│  └─ executor/                   separate container from day one — Person B
└─ fixtures/                      ⚠️ SHARED — twelve golden traces + generator
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

## Tests ship with the code they test

No follow-up PR to "add tests later." If it's worth writing, it's worth a
test in the same change.
