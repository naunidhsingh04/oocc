"""Rate limiting (Phase 6 operations). Fixed-window counters in Redis — not
a sliding-window/token-bucket algorithm: a fixed window can admit up to 2x
its stated limit right at a window boundary, which is an acceptable,
well-understood tradeoff for "stop scripted abuse and runaway retry loops,"
not a precise billing mechanism. `InMemoryRateLimiter` is the fake every
test runs against, matching `app/cache.py`'s `Cache`/`RedisCache`/
`InMemoryCache` shape exactly.

Two scopes on `POST /api/runs` (PRD §6 operations ask: "Rate limits per
user and per IP"): every request is checked against its IP first (covers
anonymous abuse), then against its user id when authenticated (a higher
ceiling — an authenticated user is accountable and worth trusting more than
a bare IP, which can be shared by many real users behind NAT/a campus
network). `POST /api/tutor` additionally enforces PRD §4.5's "Platform-
provided demo key: 10 tutor messages/day/IP" — but only when the caller
brought no `X-Provider-Key` of their own; a BYO-key request spends the
caller's own tokens; the platform has nothing to protect there.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Protocol

RUNS_PER_IP_PER_MINUTE = 20
RUNS_PER_USER_PER_MINUTE = 60

# PRD §4.5 names a specific number for a specific feature — "Platform-
# provided demo key: 10 tutor messages/day/IP" — but that feature (a real
# server-held Gemini key used when a caller brings none) was never built;
# `get_llm_client_for_tutor` today just degrades to `unavailable` with no
# key. This constant is kept for whenever that ships, not applied to
# anything yet — applying a "demo key" limit to a code path that never
# spends a demo key would be enforcing a number for a feature that doesn't
# exist. `TUTOR_PER_IP_PER_MINUTE`/`TUTOR_PER_USER_PER_MINUTE` below are
# this session's actual, general-abuse tutor limits (BYO-key requests
# still cost the platform nothing per-token, but an unbounded request rate
# is still its own abuse surface — SSE connections, RAG retrieval,
# Postgres load).
TUTOR_DEMO_KEY_PER_IP_PER_DAY = 10
TUTOR_PER_IP_PER_MINUTE = 20
TUTOR_PER_USER_PER_MINUTE = 40


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after_seconds: int


class RateLimiter(Protocol):
    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult: ...


class RedisRateLimiter:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.time()
        window = int(now // window_seconds)
        redis_key = f"oocc:ratelimit:{key}:{window}"
        count = await self._client.incr(redis_key)
        if count == 1:
            await self._client.expire(redis_key, window_seconds)
        retry_after = window_seconds - int(now % window_seconds)
        return RateLimitResult(
            allowed=count <= limit, remaining=max(0, limit - count), retry_after_seconds=retry_after
        )


class InMemoryRateLimiter:
    """No real TTL/expiry — same status as `app/cache.py`'s `InMemoryCache`:
    stands in for tests, which run in milliseconds, never long enough for a
    stale window entry to matter."""

    def __init__(self) -> None:
        self._counts: dict[tuple[str, int], int] = {}

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.time()
        window = int(now // window_seconds)
        bucket = (f"{key}:{window}", window)
        count = self._counts.get(bucket, 0) + 1
        self._counts[bucket] = count
        retry_after = window_seconds - int(now % window_seconds)
        return RateLimitResult(
            allowed=count <= limit, remaining=max(0, limit - count), retry_after_seconds=retry_after
        )
