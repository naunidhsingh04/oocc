"""THE gate for Phase 3 (docs/PRD.md §4.5): runs the entire tutor flow —
POST /api/tutor, SSE response, RAG retrieval, LLM call — with a sentinel
`X-Provider-Key` and greps every surface the key could have leaked into:
the fully rendered log stream, the SSE response body itself, every prompt
string actually sent to the model, and every row in the concept-chunk
store (standing in for a real Postgres table — see
app/rag/concept_store.py's docstring on why no live Postgres is available
in this sandbox; the same `ConceptStore` protocol backs the real one).

If this test fails, the phase is not done — full stop, per the task brief.
"""

import io
import json
from pathlib import Path

from app.agents.llm_client import FakeLLMClient
from app.logging import configure_logging
from app.main import app
from app.rag.concept_store import InMemoryConceptStore
from app.rag.embeddings import FakeEmbedder
from app.rag.seed import CURRICULUM_SEED, seed_concepts
from app.routers.tutor import get_concept_store, get_embedder_for_tutor, get_llm_client_for_tutor
from fastapi.testclient import TestClient

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "fixtures"
SENTINEL = "sk-sentinel-do-not-log-this-9f3a7c21"


def _trace(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


def test_provider_key_appears_nowhere_across_the_full_tutor_flow() -> None:
    log_stream = io.StringIO()
    configure_logging(output=log_stream)

    trace = _trace("binary_search")
    real_step = trace["steps"][2]["i"]
    fake_llm = FakeLLMClient(
        json_responses=[{"answer": "mid moved because lo/hi changed", "step_refs": [real_step]}]
    )
    fake_embedder = FakeEmbedder()
    concept_store = InMemoryConceptStore()

    app.dependency_overrides[get_llm_client_for_tutor] = lambda: fake_llm
    app.dependency_overrides[get_embedder_for_tutor] = lambda: fake_embedder
    app.dependency_overrides[get_concept_store] = lambda: concept_store
    try:
        import asyncio

        asyncio.run(seed_concepts(store=concept_store, embedder=fake_embedder))

        client = TestClient(app)
        with client.stream(
            "POST",
            "/api/tutor",
            json={
                "trace": trace,
                "source": "x = 1",
                "current_step": 2,
                "question": "why did mid change?",
                "history": [{"role": "user", "content": "what does mid mean here?"}],
            },
            headers={"X-Provider-Key": SENTINEL},
        ) as response:
            assert response.status_code == 200
            response_body = "".join(response.iter_text())
    finally:
        app.dependency_overrides.clear()
        configure_logging()

    # 1. The fully rendered log stream.
    logged_text = log_stream.getvalue()
    assert SENTINEL not in logged_text
    assert "[redacted]" in logged_text

    # 2. The response body sent back to the browser.
    assert SENTINEL not in response_body

    # 3. Every prompt actually sent to the model — the raw key from the
    #    header must never be threaded into a prompt string.
    for call in fake_llm.calls:
        assert SENTINEL not in call["system"]
        assert SENTINEL not in call["prompt"]

    # 4. Every row in the concept-chunk "table".
    for chunk, _embedding in concept_store._rows.values():  # noqa: SLF001 — direct table inspection is the point
        assert SENTINEL not in chunk.content
    assert len(concept_store) == len(CURRICULUM_SEED)
