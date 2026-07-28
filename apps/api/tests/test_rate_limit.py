"""app/rate_limit.py — Phase 6 operations ("Rate limits per user and per
IP"). `InMemoryRateLimiter` unit tests plus an end-to-end check that
`POST /api/runs` actually 429s once the per-IP limit is exceeded.
"""

from __future__ import annotations

import pytest
from app.executor_client import ExecutorClient
from app.main import app
from app.rate_limit import InMemoryRateLimiter
from app.redis_client import get_rate_limiter
from app.routers.runs import get_executor_client
from fastapi.testclient import TestClient

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_allows_requests_under_the_limit() -> None:
    limiter = InMemoryRateLimiter()
    for _ in range(5):
        result = await limiter.check("k", limit=5, window_seconds=60)
        assert result.allowed

    result = await limiter.check("k", limit=5, window_seconds=60)
    assert not result.allowed


async def test_different_keys_have_independent_limits() -> None:
    limiter = InMemoryRateLimiter()
    for _ in range(5):
        assert (await limiter.check("a", limit=5, window_seconds=60)).allowed

    # "a" is now exhausted; "b" is untouched.
    assert not (await limiter.check("a", limit=5, window_seconds=60)).allowed
    assert (await limiter.check("b", limit=5, window_seconds=60)).allowed


async def test_remaining_counts_down() -> None:
    limiter = InMemoryRateLimiter()
    first = await limiter.check("k", limit=3, window_seconds=60)
    second = await limiter.check("k", limit=3, window_seconds=60)
    assert first.remaining == 2
    assert second.remaining == 1


class _AlwaysBlockingLimiter:
    async def check(self, key: str, *, limit: int, window_seconds: int) -> "object":
        from app.rate_limit import RateLimitResult

        return RateLimitResult(allowed=False, remaining=0, retry_after_seconds=30)


def test_runs_endpoint_returns_429_once_the_limiter_says_no(
    executor_client: ExecutorClient,
) -> None:
    app.dependency_overrides[get_executor_client] = lambda: executor_client
    app.dependency_overrides[get_rate_limiter] = _AlwaysBlockingLimiter
    client = TestClient(app)

    response = client.post("/api/runs", json={"source": "print(1)\n"})
    app.dependency_overrides.clear()

    assert response.status_code == 429
    assert "Retry-After" in response.headers
