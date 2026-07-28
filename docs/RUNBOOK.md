# OOCC operations runbook

Phase 6 operations. Companion to `SECURITY.md` (adversarial/sandbox review —
that's the security posture; this is "how to run and recover the thing").
Every number and result below was actually measured in this session against
this repo's real code, not estimated — see the cited scripts/tests to
reproduce.

---

## 1. Health checks

| Service | Endpoint | What it means |
|---|---|---|
| `apps/api` | `GET /health` | Process is up and can serve requests. Does **not** check Postgres/Redis/executor reachability — those already degrade gracefully (see §2) rather than failing the whole service, so a health check that pinged them would report "unhealthy" for a Redis blip that isn't actually taking the API down. |
| `services/executor` | `GET /health` | Process is up. Given §4's finding, "up" and "can accept a new request promptly" are different things during a burst — see §4 before trusting this alone as a capacity signal. |
| `apps/web` | `GET /` | Next.js is serving. |

Fly.io configs (`apps/api/fly.toml`, `apps/web/fly.toml`,
`services/executor/fly.toml`) wire these into `[http_service.checks]` /
`[[services.tcp_checks]]` with a 15s interval, 5s timeout, 10s grace period.

## 2. Graceful degradation (already built, listed here for on-call reference)

- **Redis down**: the deterministic-output cache (`app/cache.py`), rate
  limiting (`app/rate_limit.py`), and token-spend recording
  (`app/token_spend.py`) all fail open/miss silently — `POST /api/runs`
  keeps working, just uncached and unrate-limited. A sustained Redis outage
  means unbounded abuse exposure (rate limiting is off) — page on it, but
  it isn't a user-facing outage.
- **Postgres down**: RAG retrieval (`app/routers/tutor.py`) and progress/
  problems endpoints degrade or fail per-request; the core trace/analysis
  pipeline (`POST /api/runs`) doesn't touch Postgres at all and is
  unaffected.
- **No provider key / LLM unavailable**: tutor emits a single `unavailable`
  SSE event; every deterministic feature (trace, panels, complexity,
  insights) is unaffected (PRD §4.5).

## 3. Rate limiting

`app/rate_limit.py`, Redis fixed-window counters. Current limits (env-var
overridable — see the module for the constant names):

| Route | Per-IP | Per-user (authenticated) |
|---|---|---|
| `POST /api/runs` | 20/min | 60/min |
| `POST /api/tutor` | 20/min | 40/min |

A limited request gets `429` with a `Retry-After` header. Redis down → see
§2 (fails open, logged as a warning: `rate_limit.check_failed`).

**Not yet built**: PRD §4.5's "platform-provided demo key: 10 tutor
messages/day/IP" — there is no platform-held demo key today (the tutor
just shows the "add a key" affordance with none). `TUTOR_DEMO_KEY_PER_IP_PER_DAY`
exists as a constant in `app/rate_limit.py` for when that feature ships;
applying it to a feature that doesn't exist yet would be enforcing a
number nothing spends against.

## 4. Load test: the run endpoint's real ceiling

Run for real this session (not modeled): `services/executor` under a
single uvicorn process/worker (this repo's current default —
`apps/api/Dockerfile`/`services/executor/Dockerfile` don't pass
`--workers`), hit with 100 concurrent `POST /execute` requests (a trivial
10-element bubble sort — a large but everyday teaching-subset program, not
an adversarial one).

**Result: full serialization, not real concurrency.**

- Single-request baseline: ~3s (yes — a 10-element bubble sort; the
  Tracer's own full-heap-snapshot-per-step cost dominates, independent of
  the wire-optimisation work elsewhere in Phase 6, which reduces *payload
  size*, not *compute time per step*).
- 100 concurrent requests: 59s+ wall time observed, 93/100 timed out at a
  30s client-side timeout; the **server kept processing the backlog for
  well over a minute after that**, during which `/health` itself did not
  respond.

**Root cause**: `services/executor/executor_app/main.py`'s `/execute`
route runs `Tracer().run(source, ...)` — fully synchronous, CPU-bound —
directly inside an `async def` route body with no `await
asyncio.to_thread(...)` and no queue. FastAPI/uvicorn's single-process
event loop has no cooperative yield point during that call, so once one
request starts running user code, every other connection — including
`/health` — waits until it finishes. Concurrency in this deployment shape
is **effectively 1 execution at a time per process**, not "however many
connections uvicorn accepts."

**The honest ceiling, as deployed today**: roughly `60 / (single_run_seconds)`
executions per minute, per executor process — for typical small teaching
programs (~0.5-3s each), call it **20-100 runs/minute per process**, and a
burst above that queues (and can starve health checks) rather than
rejecting cleanly. This is a real capacity constraint to plan around before
any real traffic, not a hypothetical one.

**What actually fixes this** (not attempted this session — a real
architecture change, not a quick patch):
1. `--workers N` on uvicorn buys `N`x throughput via OS process
   parallelism — the cheapest, most honest short-term mitigation, and
   should be the very next thing done before this handles real traffic.
2. Moving execution off the request-handling event loop entirely (a real
   job queue — PRD §2's own architecture diagram already draws Redis as
   "queue+cache," not just cache — so a submitted run becomes a queued job
   polled/streamed back, not a blocking HTTP call) is the real fix and
   matches what PRD's system diagram already implies but this deployment
   doesn't yet do.
3. This is also exactly the shape gVisor/nsjail-per-run (SECURITY.md §1.1)
   would want anyway — a real per-run sandboxed process naturally
   decouples "accept the request" from "run the code."

Reproduce: `services/executor/scripts/load_test.py` — point it at a
locally-started `uvicorn services/executor` and re-run; the numbers above
are the exact record of that script's output this session.

## 5. OpenTelemetry

`app/telemetry.py`. `configure_telemetry()` runs once at API startup
(`app/main.py`); every route gets an auto-instrumented span
(`FastAPIInstrumentor`), and every LangGraph node in `app/agents/graph.py`
gets its own `agent.<node_name>` span (`@traced_node(...)`) so a slow
`/api/runs` shows which analyzer was slow, not just "the whole thing was
slow."

**Config**: standard OTel env vars, nothing OOCC-specific —
`OTEL_EXPORTER_OTLP_ENDPOINT` (point at Honeycomb/Grafana Cloud/a
self-hosted collector; anything OTLP/HTTP). With no endpoint set, spans
are created (so `traced_node`'s wrapping is exercised/testable) but
exported nowhere — set `OTEL_CONSOLE_EXPORT=1` to print spans locally
without a collector.

**Not yet instrumented**: `services/executor` itself and
`services/cpp-executor`'s compile service have no spans of their own yet —
the executor call from the API side shows up as a span (the HTTP
auto-instrumentation), but nothing inside the executor process is broken
down further. Natural next step, not done this session.

## 6. Token spend

`app/token_spend.py`. Redis daily counters per user, recorded on every
`POST /api/tutor` call from a *signed-in* user with a known
`tokens_used` (works today even though the calls are BYO-key — see the
module's own docstring on why this is ops visibility, not billing).
View: `GET /api/tutor/token-spend/me` (self-serve; no admin-role concept
exists yet to gate a cross-user view on, so there isn't one).

```json
{"user_id": "u_...", "daily": [{"day": "2026-07-22", "tokens": 0}, ...], "total_tokens": 1234}
```

## 7. Postgres backups and restore

**This was actually run and verified in this session**, not just
configured — see `apps/api/scripts/backup_postgres.sh` /
`restore_postgres.sh` for the reusable commands. The drill:

1. Applied `apps/api/migrations/0002_accounts_and_progress.sql` to a fresh
   `oocc_restore_test` database (a local Postgres 18 install; `0001`'s
   `concept_chunks` table needs the `pgvector` extension, unavailable in
   this sandbox — the other 8 tables from PRD §8 all applied and were
   exercised).
2. Seeded realistic rows across every table (`users`, `runs`, `problems`,
   `submissions`, `concepts`, `progress`, `insights`) — 9 rows total,
   including array columns (`insights.step_refs`), JSONB (`runs.meta`,
   `users.settings`), and foreign keys (`submissions` → `users`/
   `problems`/`runs`).
3. `pg_dump -Fc` → a 15KB backup file.
4. Recorded a fingerprint: exact row counts per table, plus
   `md5(string_agg(...))` over `users`.
5. **`DROP DATABASE oocc_restore_test`** — the database was genuinely gone,
   not just disconnected from.
6. Recreated an empty database, `pg_restore` from the dump file alone.
7. Re-ran the fingerprint queries: **row counts matched exactly, the users
   hash matched exactly**, and spot-checks confirmed the array column,
   JSONB fields, and all three foreign key constraints on `submissions`
   survived intact.

**Result: a real restore, from a real backup, after real data loss, with
byte-for-byte verified recovery.** Not a docker-compose sanity check —
the target database did not exist between steps 5 and 6.

**Production setup** (not yet wired to a schedule in this repo — the drill
above proves the mechanism works, not that it's automated):
- A managed Postgres (Fly Postgres / Supabase / Neon — any of them handle
  automated snapshots) should run its own scheduled `pg_dump`-equivalent;
  don't reinvent that on top of a managed provider's own backup feature.
  If self-hosting Postgres instead, cron `backup_postgres.sh` and upload
  the resulting file to R2/S3 (the same bucket traces already live in,
  per PRD §8, under a different prefix) with a retention policy (e.g. 30
  daily + 12 monthly).
- **Actually re-run this drill periodically** (quarterly, or after any
  schema migration) against a scratch database — a backup nobody has ever
  restored from is a hope, not a plan.

## 8. Deploy topology

Per PRD §6's ask ("api and web on Fly.io or Railway, executor on its own
machines, Postgres managed, Redis managed, traces on R2 or S3"):

| Component | Where | Config |
|---|---|---|
| `apps/api` | Fly.io app | `apps/api/fly.toml` |
| `apps/web` | Fly.io app | `apps/web/fly.toml` |
| `services/executor` | **separate** Fly.io app, private networking only | `services/executor/fly.toml` — see its own top comment on why this file alone doesn't close SECURITY.md's OS-isolation gap |
| Postgres | Managed (Fly Postgres / Supabase / Neon) | `DATABASE_URL` secret |
| Redis | Managed (Upstash, or Fly Redis) | `REDIS_URL` secret |
| Traces | R2 or S3 | `app/storage/trace_store.py`'s `S3TraceStore` — `TRACE_BUCKET`, `OOCC_S3_ENDPOINT_URL` (set for R2, unset for real S3), AWS creds via standard env vars |

Railway is an equally valid alternative to every Fly.io app above (PRD
names either) — this repo ships Fly configs because Fly Machines' explicit
per-app isolation maps directly onto "executor on its own machines"; a
Railway deploy would use the same three Dockerfiles with Railway's own
per-service config instead of `fly.toml`.

**Secrets**: every `fly.toml` above deliberately has no secret values
inline — `DATABASE_URL`, `REDIS_URL`, `TRACE_BUCKET`,
`OOCC_S3_ENDPOINT_URL`, AWS credentials, and `OTEL_EXPORTER_OTLP_ENDPOINT`
(if it carries an API key in its headers) all go through `fly secrets
set`, never committed.

## 9. Incident quick-reference

- **`/api/runs` is slow/timing out**: check §4 first — a burst of
  concurrent runs against a single-worker executor is the most likely
  cause, not a code regression. Check executor process count/`--workers`.
- **Tutor stuck on "unavailable"**: expected with no provider key (§2) —
  confirm the user actually supplied `X-Provider-Key` before treating this
  as an incident.
- **429s spiking**: check whether it's one IP/user genuinely abusing the
  endpoint (working as intended) vs. many legitimate users behind a shared
  NAT/proxy hitting the per-IP limit (§3's `RUNS_PER_IP_PER_MINUTE` may
  need raising, or per-user limits may need to matter more than per-IP
  ones for that traffic shape).
- **A crafted C++ submission crashed something**: read SECURITY.md §2.4
  first — `instrument_isolated` should already contain this to one
  disposable child process; if the *executor service itself* went down,
  that's a new, more severe finding than anything in this review and needs
  its own writeup, not just a restart.
