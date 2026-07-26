"""POST /api/runs: end-to-end through the real executor (ASGI transport, no
mocks — see conftest.py) and the real deterministic analysis pipeline."""

from pathlib import Path

from app.executor_client import ExecutorClient
from app.main import app
from app.routers.runs import get_executor_client
from fastapi.testclient import TestClient

PROGRAMS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "generator" / "programs"


def _client(executor_client: ExecutorClient) -> TestClient:
    app.dependency_overrides[get_executor_client] = lambda: executor_client
    return TestClient(app)


def test_binary_search_run_returns_trace_analysis_and_plan(
    executor_client: ExecutorClient,
) -> None:
    client = _client(executor_client)
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


def test_runtime_error_program_still_returns_trace_and_analysis(
    executor_client: ExecutorClient,
) -> None:
    client = _client(executor_client)
    source = (PROGRAMS_DIR / "throws.py").read_text()
    response = client.post("/api/runs", json={"source": source})
    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["trace"]["status"] == "runtime_error"
    assert body["plan"]["panels"]
