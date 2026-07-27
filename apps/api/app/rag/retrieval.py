"""Top-k curriculum retrieval for the tutor's RAG step (docs/PRD.md §4.3
item 4: "top-3 curriculum chunks from pgvector")."""

from __future__ import annotations

from app.rag.concept_store import ConceptChunk, ConceptStore
from app.rag.embeddings import Embedder

DEFAULT_TOP_K = 3


async def retrieve_top_k(
    *, query: str, store: ConceptStore, embedder: Embedder, k: int = DEFAULT_TOP_K
) -> list[ConceptChunk]:
    query_embedding = await embedder.embed(query)
    return await store.search(query_embedding=query_embedding, k=k)
