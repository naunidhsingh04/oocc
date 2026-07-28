#!/usr/bin/env bash
# docs/RUNBOOK.md — Postgres restore, verified for real in Phase 6's
# operations review (see RUNBOOK.md's "backup and restore" section for the
# exact procedure and the row-count/hash proof from that run). Restores
# into whatever database DATABASE_URL points at — that database must
# already exist and be empty (or reachable to overwrite); this script does
# not create or drop it, so a real restore-drill run against a scratch
# database first is the point, not an accident.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://user:pass@host:5432/oocc_restore_test}"
DUMP_FILE="${1:?Usage: restore_postgres.sh <dump-file>}"

pg_restore "$DATABASE_URL" "$DUMP_FILE"
echo "Restored from $DUMP_FILE"
