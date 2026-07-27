"""GET/POST /api/problems* against the FastAPI app, with the Postgres-
backed problem/progress stores and the executor swapped for their
in-memory/ASGI-transport fakes via dependency_overrides — matching every
other router test in this repo (see tests/test_runs.py)."""

from __future__ import annotations

import httpx2 as httpx
import pytest
from app.executor_client import ExecutorClient
from app.main import app
from app.problems.problem_store import InMemoryProblemStore, Problem
from app.progress.progress_store import InMemoryProgressStore
from app.routers.problems import get_executor_client, get_problem_store, get_progress_store
from executor_app.main import app as real_executor_app
from fastapi.testclient import TestClient

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


ADD_TWO_PROBLEM = Problem(
    id="p_add-two",
    slug="add-two",
    title="Add Two Numbers",
    difficulty="easy",
    tags=("math",),
    statement_md="Return a + b.",
    starter_code="def solve(a, b):\n    pass\n",
    tests=(
        {"args": [1, 2], "expected": 3},
        {"args": [2, 2], "expected": 4},
    ),
)


@pytest.fixture
def client() -> TestClient:
    problem_store = InMemoryProblemStore()
    progress_store = InMemoryProgressStore()

    async def _seed() -> None:
        await problem_store.upsert(ADD_TWO_PROBLEM)

    import asyncio

    asyncio.run(_seed())

    app.dependency_overrides[get_problem_store] = lambda: problem_store
    app.dependency_overrides[get_progress_store] = lambda: progress_store
    app.dependency_overrides[get_executor_client] = lambda: ExecutorClient(
        base_url="http://executor.test",
        transport=httpx.ASGITransport(app=real_executor_app),
    )

    test_client = TestClient(app)
    test_client.progress_store = progress_store  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()


def test_list_problems_returns_summaries_without_tests(client: TestClient) -> None:
    response = client.get("/api/problems")
    assert response.status_code == 200
    body = response.json()
    assert body == [
        {"slug": "add-two", "title": "Add Two Numbers", "difficulty": "easy", "tags": ["math"]}
    ]


def test_get_problem_detail_hides_expected_values(client: TestClient) -> None:
    response = client.get("/api/problems/add-two")
    assert response.status_code == 200
    body = response.json()
    assert body["statement_md"] == "Return a + b."
    assert body["public_tests"] == [{"args": [1, 2]}, {"args": [2, 2]}]
    assert "expected" not in body["public_tests"][0]


def test_get_unknown_problem_is_404(client: TestClient) -> None:
    response = client.get("/api/problems/does-not-exist")
    assert response.status_code == 404


def test_submit_correct_solution_passes(client: TestClient) -> None:
    response = client.post(
        "/api/problems/add-two/submit",
        json={"source": "def solve(a, b):\n    return a + b\n"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] is True
    assert len(body["results"]) == 2


def test_submit_wrong_solution_fails(client: TestClient) -> None:
    response = client.post(
        "/api/problems/add-two/submit",
        json={"source": "def solve(a, b):\n    return a - b\n"},
    )
    assert response.status_code == 200
    assert response.json()["passed"] is False


def test_anonymous_submission_does_not_record_progress(client: TestClient) -> None:
    client.post(
        "/api/problems/add-two/submit",
        json={"source": "def solve(a, b):\n    return a + b\n"},
    )
    progress_store: InMemoryProgressStore = client.progress_store  # type: ignore[attr-defined]
    assert len(progress_store) == 0
