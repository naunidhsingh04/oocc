"""Lazy Redis connection for the deterministic-output cache (docs/PRD.md
§4.4). Same "don't connect until a request actually needs it" shape as
`app/routers/tutor.py`'s `_LazyPostgresConceptStore` — importing/starting
the API must not require Redis to be up.
"""

from __future__ import annotations

import os
from typing import Any

import structlog

from app.cache import Cache, RedisCache

DEFAULT_REDIS_URL = "redis://localhost:6379/0"

logger = structlog.get_logger("oocc.api")

_redis_client: Any | None = None


class _LazyRedisCache:
    """The cache is best-effort, never a hard dependency: a Redis outage
    must degrade to "run everything fresh," not break `POST /api/runs`.
    Every method swallows connection errors and logs a warning instead."""

    async def _client(self) -> Any:
        global _redis_client
        if _redis_client is None:
            import redis.asyncio as redis  # type: ignore[import-untyped]

            _redis_client = redis.from_url(os.environ.get("REDIS_URL", DEFAULT_REDIS_URL))
        return _redis_client

    async def get(self, key: str) -> str | None:
        try:
            cache = RedisCache(await self._client())
            return await cache.get(key)
        except Exception as exc:  # noqa: BLE001 — a cache miss is always a safe fallback
            logger.warning("cache.get_failed", error=str(exc))
            return None

    async def set(self, key: str, value: str, *, ttl_seconds: int = 7 * 24 * 60 * 60) -> None:
        try:
            cache = RedisCache(await self._client())
            await cache.set(key, value, ttl_seconds=ttl_seconds)
        except Exception as exc:  # noqa: BLE001 — failing to cache must never fail the request
            logger.warning("cache.set_failed", error=str(exc))


def get_cache() -> Cache:
    return _LazyRedisCache()
