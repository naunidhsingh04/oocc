"""HTTP client for services/executor — the *only* way apps/api ever runs
user code. docs/PRD.md §5: the executor is a separate service, never
imported in-process. This module makes real HTTP calls in production; tests
substitute an in-process ASGI transport pointed at the real executor app
(see apps/api/tests/conftest.py), which exercises the real executor code
without a second running process, while production still goes over the
network to `EXECUTOR_URL`. Async throughout so it composes with FastAPI's
async route handlers without blocking the event loop on network I/O.
"""

from __future__ import annotations

import os
from typing import Any

import httpx2 as httpx

DEFAULT_EXECUTOR_URL = "http://localhost:8001"


class ExecutorClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_s: float = 30.0,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url or os.environ.get("EXECUTOR_URL", DEFAULT_EXECUTOR_URL),
            transport=transport,
            timeout=timeout_s,
        )

    async def execute(self, source: str, *, stdin: str = "") -> dict[str, Any]:
        """Full trace via POST /execute."""
        response = await self._client.post("/execute", json={"source": source, "stdin": stdin})
        response.raise_for_status()
        result: dict[str, Any] = response.json()
        return result

    async def execute_counters(self, source: str, *, stdin: str = "") -> dict[str, Any]:
        """Fast step-count-only result via POST /execute/counters."""
        response = await self._client.post(
            "/execute/counters", json={"source": source, "stdin": stdin}
        )
        response.raise_for_status()
        result: dict[str, Any] = response.json()
        return result

    async def aclose(self) -> None:
        await self._client.aclose()
