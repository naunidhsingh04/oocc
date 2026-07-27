"""Postgres connection for the RAG store. Separate from any future
users/runs/problems pool (PRD §8) — this phase only needs `concept_chunks`.
"""

from __future__ import annotations

import os
from typing import Any

DEFAULT_DATABASE_URL = "postgresql://oocc:oocc@localhost:5432/oocc"


async def create_pool() -> Any:
    import asyncpg  # type: ignore[import-untyped]  # no published stubs
    from pgvector.asyncpg import register_vector

    async def _init(conn: Any) -> None:
        await register_vector(conn)

    return await asyncpg.create_pool(
        os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL),
        init=_init,
    )
