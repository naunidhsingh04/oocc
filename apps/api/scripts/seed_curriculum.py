#!/usr/bin/env python3
"""Embeds and inserts app/rag/seed.py's CURRICULUM_SEED into concept_chunks
via the real Gemini embedding model. Requires GEMINI_API_KEY (a platform
key for this one-off admin job, not a user's BYO key — this never runs
inside a request) and DATABASE_URL.

Usage: uv run --package oocc-api python apps/api/scripts/seed_curriculum.py
"""

from __future__ import annotations

import asyncio
import os
import sys


async def main() -> None:
    from app.rag.concept_store import PostgresConceptStore
    from app.rag.db import create_pool
    from app.rag.embeddings import GeminiEmbedder
    from app.rag.seed import seed_concepts

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set", file=sys.stderr)
        sys.exit(1)

    pool = await create_pool()
    try:
        store = PostgresConceptStore(pool)
        embedder = GeminiEmbedder(api_key)
        count = await seed_concepts(store=store, embedder=embedder)
        print(f"seeded {count} concept chunks")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
