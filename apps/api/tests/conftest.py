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
