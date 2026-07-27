import pytest
from app.rag.embeddings import EMBEDDING_DIM, FakeEmbedder

pytestmark = pytest.mark.anyio


async def test_fake_embedder_is_deterministic_and_unit_length() -> None:
    embedder = FakeEmbedder()
    a = await embedder.embed("binary search")
    b = await embedder.embed("binary search")
    assert a == b
    assert len(a) == EMBEDDING_DIM
    norm = sum(v * v for v in a) ** 0.5
    assert norm == pytest.approx(1.0, abs=1e-6)


async def test_fake_embedder_differs_for_different_text() -> None:
    embedder = FakeEmbedder()
    a = await embedder.embed("binary search")
    b = await embedder.embed("bubble sort")
    assert a != b
