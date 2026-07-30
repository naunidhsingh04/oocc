#!/bin/sh
# The executor has no external dependencies (no DB, no cache, no other
# service it calls) — nothing to wait on or migrate, just bind to
# whatever port the platform assigns.
set -e
exec uvicorn executor_app.main:app --app-dir services/executor --host 0.0.0.0 --port "${PORT:-8001}"
