# Deploying to Render

This is the Render-specific deploy guide: `apps/api` and `services/executor`
as Docker-based Render services, `apps/web` on Vercel (already covered by
its own build — no Dockerfile, nothing here to do beyond the env var
below). For a Fly.io deploy instead, see `docs/RUNBOOK.md` §8 and the
`fly.toml` files — different platform, same three services, same env vars.

## Order of operations

Deploy in this order — each step needs the previous one's URL.

### 1. `services/executor`

- **New Web Service** on Render (or **Private Service** if your plan
  supports it — see "Executor networking" below).
- Docker runtime, `Dockerfile path: services/executor/Dockerfile`,
  **build context: repo root** (the Dockerfile does `COPY . .` because
  it's a uv workspace member — every workspace `pyproject.toml` has to be
  present to resolve the lockfile, even though only this service's own
  dependencies end up installed).
- No environment variables required. Render sets `PORT` automatically;
  `docker-entrypoint.sh` reads it.
- Health check path: `/health`.
- Once deployed, note its URL (public: `https://<name>.onrender.com`, or
  its internal hostname if you used a Private Service — see the Connect
  panel in the Render dashboard).

### 2. `apps/api`

- **New Web Service**, Docker runtime,
  `Dockerfile path: apps/api/Dockerfile`, build context: repo root.
- Health check path: `/health`.
- Set every environment variable in the table below. At minimum:
  `ENVIRONMENT`, `CORS_ORIGINS`, `SESSION_SECRET`, `EXECUTOR_URL`
  (step 1's URL). The API **refuses to start** if `ENVIRONMENT=production`
  and `SESSION_SECRET`/`CORS_ORIGINS` are missing or insecure — see
  "Fails loud on purpose" below.
- `DATABASE_URL` is optional (see the env var table) — if you set it,
  migrations run automatically on every container start
  (`apps/api/docker-entrypoint.sh`), so there's no manual migration step
  ever, on first deploy or any deploy after.

### 3. `apps/web` (Vercel, not Render)

- Set `NEXT_PUBLIC_API_URL` to step 2's URL in the Vercel project's
  Environment Variables — **before** the next build, since
  `NEXT_PUBLIC_*` is inlined at build time, not read at runtime. Redeploy
  after setting it if you set it after the last build.
- Update `CORS_ORIGINS` on the API (step 2) to include this exact Vercel
  origin, then redeploy the API — CORS is enforced by origin, and the two
  values have to match.

## Environment variables

### `apps/api`

| Variable | Required in prod? | What it's for |
|---|---|---|
| `ENVIRONMENT` | **Yes** — set to `production` | Enables the startup checks below. Without it, the two checks are silently skipped. |
| `PORT` | No (Render sets it) | Port to bind. Defaults to 8000. |
| `CORS_ORIGINS` | **Yes** | Comma-separated exact origins allowed to call the API with credentials. Never `*`. |
| `SESSION_SECRET` | **Yes** | Signs session cookies + magic-link tokens. A forgeable, publicly-known default exists for local dev only — see below. |
| `EXECUTOR_URL` | **Yes** | Base URL of the deployed executor (step 1). |
| `DATABASE_URL` | No | Postgres connection string. Unset = accounts/problems/progress/RAG tutor-grounding stay in their fail-open fallback state; everything else (including `POST /api/runs`) works fine without it. |
| `REDIS_URL` | No | Unset = caching skipped, rate limiting doesn't limit (no crash either way). |
| `TRACE_BUCKET`, `OOCC_S3_ENDPOINT_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | No | S3/R2 trace storage. **Not currently called from any request path** — safe to leave unset entirely right now. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | No | Login-with-GitHub. Unset = that specific login button doesn't work; magic-link login is unaffected. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER` | No, but **you want this in real production** | Unset = magic-link emails are recorded in memory instead of sent — nobody can actually log in via magic link. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_CONSOLE_EXPORT` | No | Tracing. Purely additive. |

Full descriptions: `apps/api/.env.example`.

### `services/executor`

| Variable | Required in prod? | What it's for |
|---|---|---|
| `PORT` | No (Render sets it) | Port to bind. Defaults to 8001. |

That's the entire list — the executor has no database, no cache, no
outbound calls to anything but its own sandboxed interpreter.

### `apps/web` (Vercel)

| Variable | Required in prod? | What it's for |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes**, for tutor/algorithm/narration/settings/progress to work | The deployed API's URL (step 2). Unset = those features degrade gracefully to their no-key/no-backend empty state (by design — see `apps/web/lib/api/client.ts`); the site itself still works. |

## Fails loud on purpose

`apps/api/app/env_checks.py` runs at startup and **refuses to start** —
not "starts insecurely" — if `ENVIRONMENT=production` and either:

- `SESSION_SECRET` is unset (or still equals the hardcoded dev default).
  Every session cookie and magic-link token is signed with this value;
  the dev default is sitting in this repo's own source, so leaving it
  unset in production means anyone can forge a valid login.
- `CORS_ORIGINS` is unset, empty, or contains `*`. The API allows
  credentialed (cookie-bearing) cross-origin requests — a wildcard origin
  combined with credentials is a real exposure, not a style nit.

If the API won't start on Render, check its logs for a `RuntimeError`
from `env_checks.py` first — it names exactly which variable is missing.

## Executor networking

The executor runs untrusted user code (no OS-level sandbox is deployed
yet — see `SECURITY.md` §1 for the full, honest state of that gap). The
`fly.toml` deploy keeps it fully private, reachable only over Fly's
internal network, never from the public internet.

Render's exact equivalent depends on your plan:

- **If your Render plan includes Private Services**: deploy the executor
  as one. It gets no public URL; reach it from `apps/api` via its
  internal hostname (Render dashboard → the service → Connect → Internal
  tab — the internal hostname is platform-assigned, not necessarily the
  service's display name). Note Render's private networking has a
  send-only restriction for services on the free tier — this option
  generally needs a paid plan to actually *receive* private traffic.
- **Otherwise**: deploy it as an ordinary public Web Service and point
  `EXECUTOR_URL` at its public `.onrender.com` URL. This works correctly,
  but it means the executor's `/execute` endpoint is reachable from the
  public internet, not just from your API — a real reduction in the
  isolation posture the Fly.io config was built for. Acceptable for a
  demo/low-stakes deploy; revisit before this handles real user traffic
  or untrusted input at scale.

## What works locally but will break (or silently misbehave) in production

- **`SESSION_SECRET` left unset.** Locally this falls back to
  `"dev-insecure-secret-change-me-in-production"` — literally named to
  warn you — and everything "just works." In production this is now a
  hard startup failure (see above) specifically so this can't ship
  silently insecure instead.
- **`CORS_ORIGINS` left at its `http://localhost:3000` default, or set to
  `*`.** Locally this is exactly right. In production it's now a hard
  startup failure for the same reason — and even before this change, a
  wildcard would have silently blocked your real frontend from ever
  successfully calling the API (or worse, "worked" while allowing any
  origin to make credentialed requests).
- **`NEXT_PUBLIC_API_URL` unset on Vercel.** The frontend falls back to
  `http://localhost:8000`, which doesn't exist on a visitor's machine.
  The site itself still loads and works (fixtures/curriculum/problems are
  bundled directly into the Next.js build, not fetched from this API) —
  but tutor, algorithm classification, narration, settings key
  validation, and `/progress` all silently degrade to their empty/no-key
  state instead of erroring, which can look like "it's just not doing
  anything" rather than "it's misconfigured." Check the browser console
  for `ERR_CONNECTION_REFUSED` against `localhost:8000` if a deployed
  build seems to be doing nothing on those surfaces.
- **Magic-link login "succeeding" with no email ever sent.** Locally
  (`SMTP_HOST` unset) magic links are captured in memory, and tests/dev
  workflows read them straight out of that in-memory store. In production
  with `SMTP_HOST` still unset, the "check your email" flow completes
  with a 200 and nothing is ever delivered — a functionally broken login
  path that looks successful from the API's point of view. Set the full
  `SMTP_*` block if you need magic-link login to actually work.
- **Postgres/Redis being "down" reads as normal, not an incident.** Every
  Postgres/Redis-backed feature in this codebase is deliberately fail-open
  (see `apps/api/app/db.py`, `app/redis_client.py`, `app/rag/`'s lazy
  stores) — `POST /api/runs` and the tutor keep working with no error even
  if you never provision either. This is intentional, but it also means a
  *real* outage of a *configured* Postgres/Redis looks identical to "never
  configured" from the outside — nothing pages you. If you do provision
  either, monitor it separately; the app itself won't tell you it's gone.
- **The executor's sandbox isolation.** Read "Executor networking" above
  and `SECURITY.md` §1 before treating this deploy as safe for
  adversarial/public traffic — the known
  `().__class__.__bases__[0].__subclasses__()`-style sandbox escape is
  still open by design (there's a regression test that deliberately keeps
  it open, so it isn't accidentally "fixed" by an unrelated change without
  anyone noticing what actually closed it). Fly Machines / Render's
  container boundary is real isolation *between* deployed services, not
  the per-run sandboxing (gVisor/nsjail) this still needs before it's safe
  against a hostile user submitting arbitrary Python.
- **`uv`/dev tooling not being available at runtime.** The Dockerfiles are
  multi-stage: the final image has no `uv`, no compilers, no test/lint
  tooling, only the built virtualenv and the two source trees actually
  imported (`apps/api` or `services/executor`, plus
  `packages/contracts/python` for the shared contract models). If you ever
  add a runtime code path that shells out to `uv` or reads a file from
  another workspace member, it will work in every dev/test environment in
  this repo and fail only in the deployed container — there's nothing else
  there.
- **Untested against real Docker.** No `docker` binary has ever been
  available in the sandbox these Dockerfiles were written in (same
  limitation `docker-compose.yml`'s own executor-service comment already
  notes) — the build steps were validated by running the equivalent `uv
  sync`/import steps directly, not via `docker build`. Run an actual
  `docker build` locally before your first real Render deploy, not as the
  first time this gets tested.
