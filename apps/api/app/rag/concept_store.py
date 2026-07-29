"""The `concept_chunks` table (docs/PRD.md §8) and its two implementations:
`PostgresConceptStore` (real, pgvector cosine distance) and
`InMemoryConceptStore` (fake, cosine similarity in plain Python). No
Postgres is reachable in this dev sandbox — see CLAUDE.md's note on the
executor/ASGI-transport testing pattern — so unlike `ExecutorClient`,
`PostgresConceptStore` has no in-process-server trick available and is
exercised only by real deployment; every test in tests/rag/ runs against
`InMemoryConceptStore` through the same `ConceptStore` protocol, so the
retrieval logic itself (app/rag/retrieval.py) is fully covered regardless
of which store backs it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ConceptChunk:
    id: str
    concept_id: str
    content: str


class ConceptStore(Protocol):
    async def add_chunk(
        self, *, chunk_id: str, concept_id: str, content: str, embedding: list[float]
    ) -> None: ...

    async def search(self, *, query_embedding: list[float], k: int = 3) -> list[ConceptChunk]: ...


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if not norm_a or not norm_b:
        return 0.0
    return float(dot / (norm_a * norm_b))


class InMemoryConceptStore:
    def __init__(self) -> None:
        self._rows: dict[str, tuple[ConceptChunk, list[float]]] = {}

    async def add_chunk(
        self, *, chunk_id: str, concept_id: str, content: str, embedding: list[float]
    ) -> None:
        chunk = ConceptChunk(id=chunk_id, concept_id=concept_id, content=content)
        self._rows[chunk_id] = (chunk, embedding)

    async def search(self, *, query_embedding: list[float], k: int = 3) -> list[ConceptChunk]:
        scored = sorted(
            self._rows.values(),
            key=lambda row: _cosine_similarity(row[1], query_embedding),
            reverse=True,
        )
        return [chunk for chunk, _embedding in scored[:k]]

    def __len__(self) -> int:
        return len(self._rows)


class PostgresConceptStore:
    """Real store, an `asyncpg` pool. `<=>` is pgvector's cosine-distance
    operator — ascending distance is descending similarity, so `ORDER BY
    embedding <=> $1 LIMIT $2` is exactly top-k nearest."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def add_chunk(
        self, *, chunk_id: str, concept_id: str, content: str, embedding: list[float]
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO concept_chunks (id, concept_id, content, embedding)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE
                SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
                """,
                chunk_id,
                concept_id,
                content,
                embedding,
            )

    async def search(self, *, query_embedding: list[float], k: int = 3) -> list[ConceptChunk]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, concept_id, content
                FROM concept_chunks
                ORDER BY embedding <=> $1
                LIMIT $2
                """,
                query_embedding,
                k,
            )
        return [
            ConceptChunk(id=r["id"], concept_id=r["concept_id"], content=r["content"]) for r in rows
        ]
