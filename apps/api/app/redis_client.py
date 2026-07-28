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
from app.rate_limit import RateLimitResult, RedisRateLimiter
from app.token_spend import DailySpend, RedisTokenSpendStore

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


class _LazyRedisRateLimiter:
    """Same "best-effort, never a hard dependency" shape as `_LazyRedisCache`
    above — a Redis outage fails *open* (the request is allowed), not
    closed: matching this codebase's existing rule that infra flakiness
    must never break `POST /api/runs` (see `app/routers/tutor.py`'s and
    this module's own `_LazyRedisCache` docstrings for the same call made
    for the deterministic cache and RAG retrieval). A rate limiter that
    fails closed on a Redis blip would turn "Redis had a bad five minutes"
    into "the whole product stopped accepting runs," which is a worse
    outcome than briefly having no rate limiting at all.
    """

    async def _client(self) -> Any:
        global _redis_client
        if _redis_client is None:
            import redis.asyncio as redis  # type: ignore[import-untyped]

            _redis_client = redis.from_url(os.environ.get("REDIS_URL", DEFAULT_REDIS_URL))
        return _redis_client

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        try:
            limiter = RedisRateLimiter(await self._client())
            return await limiter.check(key, limit=limit, window_seconds=window_seconds)
        except Exception as exc:  # noqa: BLE001 — fail open, see class docstring
            logger.warning("rate_limit.check_failed", error=str(exc))
            return RateLimitResult(allowed=True, remaining=limit, retry_after_seconds=0)


def get_rate_limiter() -> Any:
    return _LazyRedisRateLimiter()


class _LazyRedisTokenSpendStore:
    """Same lazy-connect, fail-open shape as `_LazyRedisCache`/
    `_LazyRedisRateLimiter` above: a Redis outage must not turn "we
    couldn't log a spend metric" into "the tutor stopped answering
    questions." A failed `record` is silently dropped (a gap in an ops
    dashboard, not a user-facing failure); a failed `get_range` returns all
    zeros rather than raising, so the admin view degrades to "no data" note
    a 500.
    """

    async def _client(self) -> Any:
        global _redis_client
        if _redis_client is None:
            import redis.asyncio as redis  # type: ignore[import-untyped]

            _redis_client = redis.from_url(os.environ.get("REDIS_URL", DEFAULT_REDIS_URL))
        return _redis_client

    async def record(self, user_id: str, tokens: int, *, day: str | None = None) -> None:
        try:
            store = RedisTokenSpendStore(await self._client())
            await store.record(user_id, tokens, day=day)
        except Exception as exc:  # noqa: BLE001 — see class docstring
            logger.warning("token_spend.record_failed", error=str(exc))

    async def get_range(self, user_id: str, *, days: int) -> list[DailySpend]:
        try:
            store = RedisTokenSpendStore(await self._client())
            return await store.get_range(user_id, days=days)
        except Exception as exc:  # noqa: BLE001 — see class docstring
            logger.warning("token_spend.get_range_failed", error=str(exc))
            from app.token_spend import today_str
            from datetime import UTC, datetime, timedelta

            now = datetime.now(UTC)
            return [
                DailySpend(day=today_str(now - timedelta(days=offset)), tokens=0)
                for offset in reversed(range(days))
            ]


def get_token_spend_store() -> Any:
    return _LazyRedisTokenSpendStore()
