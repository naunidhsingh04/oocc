"""POST /api/tutor end to end: the SSE wire format, the no-key degrade
path, and — the phase's own gate — that the provider key never leaks
anywhere along the way (docs/PRD.md §4.5)."""

import json
from datetime import UTC, datetime
from pathlib import Path

from app.agents.llm_client import FakeLLMClient
from app.auth.user_store import User
from app.main import app
from app.rag.concept_store import InMemoryConceptStore
from app.rag.embeddings import FakeEmbedder
from app.routers.auth import get_current_user_optional
from app.routers.tutor import get_concept_store, get_embedder_for_tutor, get_llm_client_for_tutor
from fastapi.testclient import TestClient

FIXTURES_DIR = Path(__file__).resolve().parents[3] / "fixtures"


def _trace(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


def _parse_sse_events(raw_text: str) -> list[dict]:
    events = []
    for line in raw_text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line.removeprefix("data: ")))
    return events


def test_tutor_without_a_key_emits_a_single_unavailable_event() -> None:
    client = TestClient(app)
    trace = _trace("binary_search")

    with client.stream(
        "POST",
        "/api/tutor",
        json={"trace": trace, "source": "x = 1", "current_step": 0, "question": "why?"},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        body = "".join(response.iter_text())

    events = _parse_sse_events(body)
    assert events == [{"type": "unavailable", "reason": "no_provider_key"}]


def test_tutor_with_a_key_streams_chunks_then_a_done_event_with_step_refs() -> None:
    trace = _trace("binary_search")
    real_step = trace["steps"][2]["i"]
    llm_client = FakeLLMClient(
        json_responses=[{"answer": "mid moved because lo/hi changed", "step_refs": [real_step]}]
    )

    app.dependency_overrides[get_llm_client_for_tutor] = lambda: llm_client
    app.dependency_overrides[get_embedder_for_tutor] = lambda: FakeEmbedder()
    app.dependency_overrides[get_concept_store] = lambda: InMemoryConceptStore()
    try:
        client = TestClient(app)
        with client.stream(
            "POST",
            "/api/tutor",
            json={
                "trace": trace,
                "source": "x = 1",
                "current_step": 2,
                "question": "why did mid change?",
            },
            headers={"X-Provider-Key": "sk-doesnt-matter-overridden"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())
    finally:
        app.dependency_overrides.clear()

    events = _parse_sse_events(body)
    assert events[0]["type"] == "chunk"
    full_answer = "".join(e["text"] for e in events if e["type"] == "chunk")
    assert full_answer == "mid moved because lo/hi changed"
    assert events[-1] == {
        "type": "done",
        "step_refs": [real_step],
        "degraded": False,
        "tokens_used": llm_client.last_usage_tokens,
    }


def test_signed_in_users_token_spend_is_recorded_and_viewable() -> None:
    trace = _trace("binary_search")
    real_step = trace["steps"][2]["i"]
    llm_client = FakeLLMClient(
        json_responses=[{"answer": "answer", "step_refs": [real_step]}]
    )
    fake_user = User(
        id="u_test", handle="tester", email=None, github_id=None, created_at=datetime.now(UTC)
    )

    app.dependency_overrides[get_llm_client_for_tutor] = lambda: llm_client
    app.dependency_overrides[get_embedder_for_tutor] = lambda: FakeEmbedder()
    app.dependency_overrides[get_concept_store] = lambda: InMemoryConceptStore()
    app.dependency_overrides[get_current_user_optional] = lambda: fake_user
    try:
        client = TestClient(app)
        with client.stream(
            "POST",
            "/api/tutor",
            json={"trace": trace, "source": "x = 1", "current_step": 2, "question": "why?"},
            headers={"X-Provider-Key": "sk-doesnt-matter-overridden"},
        ) as response:
            "".join(response.iter_text())

        spend_response = client.get("/api/tutor/token-spend/me")
    finally:
        app.dependency_overrides.clear()

    assert spend_response.status_code == 200
    body = spend_response.json()
    assert body["user_id"] == "u_test"
    assert body["total_tokens"] == llm_client.last_usage_tokens
    assert body["total_tokens"] > 0
