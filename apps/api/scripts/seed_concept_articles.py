#!/usr/bin/env python3
"""Populates the `concepts` table (app/rag/seed.py's `CONCEPT_ARTICLES`,
migrations/0002_accounts_and_progress.sql) — the 12 full curriculum
articles, distinct from `concept_chunks` (seeded by seed_curriculum.py).

Usage: uv run --package oocc-api python apps/api/scripts/seed_concept_articles.py
"""

from __future__ import annotations

import asyncio


async def main() -> None:
    from app.curriculum.articles_store import PostgresConceptArticleStore
    from app.db import get_pool
    from app.rag.seed import seed_concept_articles

    store = PostgresConceptArticleStore(await get_pool())
    count = await seed_concept_articles(store=store)
    print(f"seeded {count} concept articles")


if __name__ == "__main__":
    asyncio.run(main())
