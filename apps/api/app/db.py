"""Shared Postgres connection pool for the Phase 5 tables (users, runs,
problems, submissions, concepts, progress, insights — docs/PRD.md §8,
migrations/0002_accounts_and_progress.sql). Separate from app/rag/db.py's
pool, which additionally registers pgvector's codec and is scoped to
`concept_chunks`; none of these tables have a vector column, so a plain
asyncpg pool is enough. One process-wide pool, created lazily on first use
(same reasoning as app/redis_client.py and app/routers/tutor.py's
`_LazyPostgresConceptStore`): importing/starting the API must not require
Postgres to be up.
"""

from __future__ import annotations

import os
from typing import Any

DEFAULT_DATABASE_URL = "postgresql://oocc:oocc@localhost:5432/oocc"

_pool: Any | None = None


async def get_pool() -> Any:
    global _pool
    if _pool is None:
        import asyncpg  # type: ignore[import-untyped]

        _pool = await asyncpg.create_pool(os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))
    return _pool
