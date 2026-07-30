#!/bin/sh
# Runs on every container start (Render, `docker run`, `docker compose up`).
# Migrations are idempotent (every migrations/*.sql uses IF NOT EXISTS —
# see scripts/migrate.py's own docstring), so running them unconditionally
# on every boot is safe, not just on the first deploy.
#
# DATABASE_URL is intentionally optional here even though scripts/migrate.py
# itself defaults to a localhost connection string: Postgres is one of this
# API's several lazily-connected, fail-open dependencies (app/db.py,
# app/rag/db.py, app/redis_client.py all follow the same rule) — a deploy
# that hasn't provisioned Postgres yet must still be able to start and serve
# POST /api/runs. Only run (and only let a failure stop the boot) when the
# operator has actually pointed this at a real database.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "docker-entrypoint: DATABASE_URL is set, applying migrations..."
  python apps/api/scripts/migrate.py
else
  echo "docker-entrypoint: DATABASE_URL is not set, skipping migrations (accounts/progress/RAG features will stay in their fail-open fallback state)."
fi

exec uvicorn app.main:app --app-dir apps/api --host 0.0.0.0 --port "${PORT:-8000}"
