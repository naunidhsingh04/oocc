"""The deterministic-output cache (docs/PRD.md §4.4): `sha256(source +
stdin + language)` -> the full trace and every deterministic agent output,
7-day TTL. Never the LLM-only outputs (algorithm_classifier, narration) —
those are cheap, request-scoped, and tied to whichever provider key the
caller happened to bring; caching them would mean serving one user's
BYO-key output to another user for free, which is a privacy and cost
problem the PRD never asks for. "A returning user on the same program costs
zero LLM calls" (§4.4) is true because the *executor run* and every
*deterministic* analyzer is skipped, not because an LLM response is reused.
"""

from __future__ import annotations

import hashlib
from typing import Any, Protocol

DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60


def cache_key(*, source: str, stdin: str, language: str = "python") -> str:
    digest = hashlib.sha256(f"{source}\x00{stdin}\x00{language}".encode()).hexdigest()
    return f"oocc:run:{digest}"


class Cache(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(
        self, key: str, value: str, *, ttl_seconds: int = DEFAULT_TTL_SECONDS
    ) -> None: ...


class RedisCache:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def get(self, key: str) -> str | None:
        value = await self._client.get(key)
        if value is None:
            return None
        return value.decode() if isinstance(value, bytes) else value

    async def set(self, key: str, value: str, *, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        await self._client.set(key, value, ex=ttl_seconds)


class InMemoryCache:
    """No TTL enforcement — this stands in for tests, which run in
    milliseconds; a real Redis instance enforces the real 7-day expiry."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, *, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        self._store[key] = value

    def __len__(self) -> int:
        return len(self._store)
