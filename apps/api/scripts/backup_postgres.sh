#!/usr/bin/env bash
# docs/RUNBOOK.md — Postgres backup. Custom format (`-Fc`), not plain SQL:
# supports `pg_restore`'s parallel restore and selective table/schema
# restore, and is compressed by default. Point DATABASE_URL at the real
# managed Postgres in production; this script has no opinion about where
# the resulting file goes next (upload to R2/S3 is the caller's job — see
# docs/RUNBOOK.md's backup section for the retention/upload policy).
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://user:pass@host:5432/oocc}"
OUT="${1:?Usage: backup_postgres.sh <output-file.dump>}"

pg_dump "$DATABASE_URL" -Fc -f "$OUT"
echo "Backup written to $OUT ($(du -h "$OUT" | cut -f1))"
