"""`concepts` table (docs/PRD.md §8,
migrations/0002_accounts_and_progress.sql) — full curriculum articles.
Deliberately separate from app/rag/concept_store.py's `ConceptStore`: that
one holds short passages embedded for the tutor's RAG (`concept_chunks`);
this one holds the full article body + prerequisite chain for the
curriculum/progress UI. Both key off the same human-chosen concept id
(e.g. `"binary-search"`), but neither table is derived from the other —
see apps/api/app/rag/seed.py's `CONCEPT_ARTICLES` for how the 12 concept
ids line up across both.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ConceptArticle:
    id: str
    slug: str
    title: str
    body_md: str
    prereq_ids: tuple[str, ...]


class ConceptArticleStore(Protocol):
    async def list_all(self) -> list[ConceptArticle]: ...
    async def get_by_slug(self, slug: str) -> ConceptArticle | None: ...
    async def upsert(self, article: ConceptArticle) -> None: ...


class InMemoryConceptArticleStore:
    def __init__(self) -> None:
        self._by_slug: dict[str, ConceptArticle] = {}

    async def list_all(self) -> list[ConceptArticle]:
        return list(self._by_slug.values())

    async def get_by_slug(self, slug: str) -> ConceptArticle | None:
        return self._by_slug.get(slug)

    async def upsert(self, article: ConceptArticle) -> None:
        self._by_slug[article.slug] = article

    def __len__(self) -> int:
        return len(self._by_slug)


class PostgresConceptArticleStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @staticmethod
    def _row_to_article(row: Any) -> ConceptArticle:
        return ConceptArticle(
            id=row["id"],
            slug=row["slug"],
            title=row["title"],
            body_md=row["body_md"],
            prereq_ids=tuple(row["prereq_ids"] or ()),
        )

    async def list_all(self) -> list[ConceptArticle]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM concepts ORDER BY id")
        return [self._row_to_article(r) for r in rows]

    async def get_by_slug(self, slug: str) -> ConceptArticle | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM concepts WHERE slug = $1", slug)
        return self._row_to_article(row) if row else None

    async def upsert(self, article: ConceptArticle) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO concepts (id, slug, title, body_md, prereq_ids)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE
                SET slug = EXCLUDED.slug,
                    title = EXCLUDED.title,
                    body_md = EXCLUDED.body_md,
                    prereq_ids = EXCLUDED.prereq_ids
                """,
                article.id,
                article.slug,
                article.title,
                article.body_md,
                list(article.prereq_ids),
            )
