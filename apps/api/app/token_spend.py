"""Token spend per user per day (Phase 6 operations ask). Redis-backed
daily counters, the same fixed-window shape `app/rate_limit.py` uses — this
is an operational visibility tool ("who's costing the platform tokens, and
is anyone anomalous"), not a billing ledger. A real billing system needs
durable storage (Postgres) and exact reconciliation against the LLM
provider's own invoice; this doesn't attempt that, and says so.

Only ever recorded for an authenticated user with a *platform-incurred*
cost — which today is none, since PRD §4.5's demo key was never built
(`app/rate_limit.py`'s docstring already flags this) and every current LLM
call spends the caller's own BYO key. `record_token_spend` is still wired
into the tutor endpoint now, ahead of that feature landing, matching
`app/rate_limit.py`'s own general (not demo-key-specific) tutor limits —
so the view has real data to show demonstrating the mechanism, and needs
no changes the day a demo key actually exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol


def _day_key(user_id: str, day: str) -> str:
    return f"oocc:tokenspend:{user_id}:{day}"


def today_str(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).strftime("%Y-%m-%d")


@dataclass
class DailySpend:
    day: str
    tokens: int


class TokenSpendStore(Protocol):
    async def record(self, user_id: str, tokens: int, *, day: str | None = None) -> None: ...
    async def get_range(self, user_id: str, *, days: int) -> list[DailySpend]: ...


class RedisTokenSpendStore:
    def __init__(self, client: Any) -> None:
        self._client = client

    async def record(self, user_id: str, tokens: int, *, day: str | None = None) -> None:
        key = _day_key(user_id, day or today_str())
        await self._client.incrby(key, tokens)
        # 90 days, an ops window not a retention policy
        await self._client.expire(key, 90 * 24 * 60 * 60)

    async def get_range(self, user_id: str, *, days: int) -> list[DailySpend]:
        now = datetime.now(UTC)
        results = []
        for offset in range(days):
            day = today_str(now - timedelta(days=offset))
            raw = await self._client.get(_day_key(user_id, day))
            tokens = int(raw) if raw else 0
            results.append(DailySpend(day=day, tokens=tokens))
        return list(reversed(results))


class InMemoryTokenSpendStore:
    """Fake for tests — same status as every other `InMemory*` in this
    codebase (app/cache.py, app/rate_limit.py): no real TTL, exact for the
    millisecond-scale a test runs in."""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}

    async def record(self, user_id: str, tokens: int, *, day: str | None = None) -> None:
        key = _day_key(user_id, day or today_str())
        self._counts[key] = self._counts.get(key, 0) + tokens

    async def get_range(self, user_id: str, *, days: int) -> list[DailySpend]:
        now = datetime.now(UTC)
        results = []
        for offset in range(days):
            day = today_str(now - timedelta(days=offset))
            results.append(DailySpend(day=day, tokens=self._counts.get(_day_key(user_id, day), 0)))
        return list(reversed(results))
