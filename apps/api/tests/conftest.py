"""Shared test fixtures. `executor_client` runs the real services/executor
FastAPI app in-process via an ASGI transport — no second process, no real
network — while production code (app.executor_client.ExecutorClient with no
transport override) always makes a real HTTP call to EXECUTOR_URL. See
app/executor_client.py.

Async tests use the `anyio` pytest plugin (a transitive dependency of
httpx2/FastAPI, auto-registered — no separate pytest-asyncio needed):
mark a test `@pytest.mark.anyio` and it runs on the backend below.
"""

from __future__ import annotations

import httpx2 as httpx
import pytest
from app.cache import InMemoryCache
from app.executor_client import ExecutorClient
from app.main import app as api_app
from app.rate_limit import InMemoryRateLimiter
from app.redis_client import get_rate_limiter, get_token_spend_store
from app.token_spend import InMemoryTokenSpendStore
from executor_app.main import app as real_executor_app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def executor_client() -> ExecutorClient:
    return ExecutorClient(
        base_url="http://executor.test",
        transport=httpx.ASGITransport(app=real_executor_app),
    )


@pytest.fixture
def cache() -> InMemoryCache:
    """No real Redis in tests — see app/redis_client.py's lazy-connect
    docstring for why the default dependency would otherwise try to reach
    one on the very first cache lookup."""
    return InMemoryCache()


@pytest.fixture(autouse=True)
def _fake_rate_limiter_and_token_spend_store() -> None:
    """Autouse, unlike `cache` above: rate limiting and token-spend
    recording (app/rate_limit.py, app/token_spend.py) sit in front of/inside
    every request to their routes, not something an individual test opts
    into per call — every test that hits `/api/runs` or `/api/tutor`
    through the real `app` would otherwise try (and, thanks to their
    `_LazyRedis*`'s fail-open behavior, eventually succeed at failing) a
    real Redis connection on every single request, which is both slow (a
    real connection-refused round-trip per test) and pointless to actually
    exercise here — that fail-open path has its own coverage.

    The token-spend store is one shared instance for the test's whole
    lifetime (not a fresh one per request, unlike the rate limiter below):
    a test that records a spend via `POST /api/tutor` and then reads it
    back via `GET /api/tutor/token-spend/me` is two separate HTTP requests
    against the same running app, and a fresh store per dependency
    resolution would silently drop the write between them. The rate
    limiter stays fresh-per-request on purpose — nothing here needs its
    state to persist across requests, and a persistent one would risk one
    test's calls tripping another's limit.
    """
    api_app.dependency_overrides[get_rate_limiter] = InMemoryRateLimiter
    token_spend_store = InMemoryTokenSpendStore()
    api_app.dependency_overrides[get_token_spend_store] = lambda: token_spend_store
    yield
    # .pop, not del: several existing tests call
    # `app.dependency_overrides.clear()` themselves mid-test, which would
    # already have removed this key by the time this teardown runs.
    api_app.dependency_overrides.pop(get_rate_limiter, None)
    api_app.dependency_overrides.pop(get_token_spend_store, None)
