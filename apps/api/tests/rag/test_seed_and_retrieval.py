"""The seed + retrieval pipeline end to end, against InMemoryConceptStore —
docs/PRD.md §4.3's "top-3 curriculum chunks from pgvector", exercised
through the same ConceptStore protocol the real pgvector store implements.
"""

import pytest
from app.rag.concept_store import InMemoryConceptStore
from app.rag.embeddings import FakeEmbedder
from app.rag.retrieval import retrieve_top_k
from app.rag.seed import CURRICULUM_SEED, seed_concepts

pytestmark = pytest.mark.anyio


async def test_seed_concepts_inserts_every_curriculum_entry() -> None:
    store = InMemoryConceptStore()
    embedder = FakeEmbedder()

    count = await seed_concepts(store=store, embedder=embedder)

    assert count == len(CURRICULUM_SEED)
    assert len(store) == len(CURRICULUM_SEED)


async def test_retrieve_top_k_finds_the_seeded_concept_for_its_own_text() -> None:
    store = InMemoryConceptStore()
    embedder = FakeEmbedder()
    await seed_concepts(store=store, embedder=embedder)

    binary_search_text = next(
        e["content"] for e in CURRICULUM_SEED if e["concept_id"] == "binary-search"
    )
    results = await retrieve_top_k(query=binary_search_text, store=store, embedder=embedder, k=3)

    assert len(results) == 3
    assert results[0].concept_id == "binary-search"
