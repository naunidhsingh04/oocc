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

## Tests ship with the code they test

No follow-up PR to "add tests later." If it's worth writing, it's worth a
test in the same change.
