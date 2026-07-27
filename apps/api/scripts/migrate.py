#!/usr/bin/env python3
"""Applies every migrations/*.sql file, in filename order, against
DATABASE_URL. No migration framework (Alembic etc.) for one table — see
app/rag/db.py's docstring. Idempotent: every migration file uses
`IF NOT EXISTS`, so re-running is a no-op.

Usage: uv run --package oocc-api python apps/api/scripts/migrate.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
DEFAULT_DATABASE_URL = "postgresql://oocc:oocc@localhost:5432/oocc"


async def main() -> None:
    import asyncpg

    database_url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    conn = await asyncpg.connect(database_url)
    try:
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            print(f"applying {path.name}...")
            await conn.execute(path.read_text())
        print("done")
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except OSError as exc:
        print(f"could not reach the database: {exc}", file=sys.stderr)
        sys.exit(1)
