"""POST /api/runs: end-to-end through the real executor (ASGI transport, no
mocks — see conftest.py) and the real deterministic analysis pipeline."""

from pathlib import Path

from app.agents.llm_client import FakeLLMClient
from app.cache import InMemoryCache
from app.executor_client import ExecutorClient
from app.main import app
from app.routers.runs import get_cache, get_executor_client, get_llm_client
from fastapi.testclient import TestClient

PROGRAMS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "generator" / "programs"


def _client(executor_client: ExecutorClient, cache: InMemoryCache) -> TestClient:
    app.dependency_overrides[get_executor_client] = lambda: executor_client
    app.dependency_overrides[get_cache] = lambda: cache
    return TestClient(app)


def test_binary_search_run_returns_trace_analysis_and_plan(
    executor_client: ExecutorClient, cache: InMemoryCache
) -> None:
    client = _client(executor_client, cache)
    source = (PROGRAMS_DIR / "binary_search.py").read_text()
    response = client.post(
        "/api/runs", json={"source": source, "stdin": "1 3 5 7 9 11 13 15 17 19\n13\n"}
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["trace"]["status"] == "ok"
    assert any(s["kind"] == "array" for s in body["analysis"]["structures"])
    assert body["analysis"]["complexity"]["best_fit"] == "log_n"
    assert any(p["type"] == "array" for p in body["plan"]["panels"])
    # No X-Provider-Key on this request -> LLM-only fields degrade, and the
    # capability flag says so up front rather than the frontend having to
    # find out via a failed tutor request.
    assert body["algorithm"] is None
    assert body["narration"] == {
        "insights": [],
        "complexity": None,
        "plan_summary": None,
        "step_ranges": [],
    }
    assert body["capabilities"] == {"tutor": False, "narration": False}


def test_run_with_a_provider_key_reports_capabilities_true(
    executor_client: ExecutorClient, cache: InMemoryCache
) -> None:
    client = _client(executor_client, cache)
    app.dependency_overrides[get_llm_client] = lambda: FakeLLMClient(auto_fill_schema=True)
    source = (PROGRAMS_DIR / "binary_search.py").read_text()
    response = client.post(
        "/api/runs",
        json={"source": source, "stdin": "1 3 5 7 9 11 13 15 17 19\n13\n"},
        headers={"X-Provider-Key": "sk-does-not-matter-the-dependency-is-overridden"},
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["capabilities"] == {"tutor": True, "narration": True}


def test_runtime_error_program_still_returns_trace_and_analysis(
    executor_client: ExecutorClient, cache: InMemoryCache
) -> None:
    client = _client(executor_client, cache)
    source = (PROGRAMS_DIR / "throws.py").read_text()
    response = client.post("/api/runs", json={"source": source})
    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["trace"]["status"] == "runtime_error"
    assert body["plan"]["panels"]


def test_second_run_of_the_same_program_is_served_from_cache(
    executor_client: ExecutorClient, cache: InMemoryCache
) -> None:
    client = _client(executor_client, cache)
    source = (PROGRAMS_DIR / "binary_search.py").read_text()
    body_payload = {"source": source, "stdin": "1 3 5 7 9 11 13 15 17 19\n13\n"}

    first = client.post("/api/runs", json=body_payload)
    assert len(cache) == 1
    second = client.post("/api/runs", json=body_payload)
    app.dependency_overrides.clear()

    assert first.status_code == second.status_code == 200
    # Same deterministic content, served the second time without a second
    # executor run — the run_id inside a fresh trace would differ if the
    # executor had actually re-run, so an identical trace is the tell.
    assert first.json()["trace"] == second.json()["trace"]
    assert len(cache) == 1
