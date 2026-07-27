import pytest
from app.rag.concept_store import InMemoryConceptStore
from app.rag.embeddings import FakeEmbedder

pytestmark = pytest.mark.anyio


async def test_search_ranks_the_exact_match_first() -> None:
    store = InMemoryConceptStore()
    embedder = FakeEmbedder()

    for concept_id, text in [
        ("a", "binary search halves the window"),
        ("b", "bubble sort swaps adjacent elements"),
        ("c", "dynamic programming reuses subproblem results"),
    ]:
        embedding = await embedder.embed(text)
        await store.add_chunk(
            chunk_id=concept_id, concept_id=concept_id, content=text, embedding=embedding
        )

    query_embedding = await embedder.embed("binary search halves the window")
    results = await store.search(query_embedding=query_embedding, k=2)

    assert results[0].id == "a"
    assert len(results) == 2


async def test_add_chunk_upserts_by_id() -> None:
    store = InMemoryConceptStore()
    embedder = FakeEmbedder()
    v1 = await embedder.embed("v1")
    v2 = await embedder.embed("v2")
    await store.add_chunk(chunk_id="x", concept_id="x", content="v1", embedding=v1)
    await store.add_chunk(chunk_id="x", concept_id="x", content="v2", embedding=v2)

    assert len(store) == 1
    results = await store.search(query_embedding=v2, k=1)
    assert results[0].content == "v2"
