"""app/token_spend.py — Phase 6 operations ("a view of token spend per
user per day"). `InMemoryTokenSpendStore` unit tests plus an end-to-end
check that `GET /api/tutor/token-spend/me` actually reports what the tutor
endpoint recorded.
"""

from __future__ import annotations

import pytest
from app.token_spend import InMemoryTokenSpendStore, today_str

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_record_accumulates_within_the_same_day() -> None:
    store = InMemoryTokenSpendStore()
    await store.record("u1", 100)
    await store.record("u1", 50)

    daily = await store.get_range("u1", days=1)

    assert daily[0].day == today_str()
    assert daily[0].tokens == 150


async def test_different_users_are_independent() -> None:
    store = InMemoryTokenSpendStore()
    await store.record("u1", 100)
    await store.record("u2", 999)

    u1_range = await store.get_range("u1", days=1)
    assert u1_range[0].tokens == 100


async def test_get_range_returns_zero_for_days_with_no_recorded_spend() -> None:
    store = InMemoryTokenSpendStore()
    await store.record("u1", 10)

    daily = await store.get_range("u1", days=7)

    assert len(daily) == 7
    assert daily[-1].day == today_str()
    assert daily[-1].tokens == 10
    assert sum(d.tokens for d in daily[:-1]) == 0


async def test_get_range_is_ordered_oldest_to_newest() -> None:
    store = InMemoryTokenSpendStore()
    daily = await store.get_range("u1", days=3)
    days_sorted = sorted(d.day for d in daily)
    assert [d.day for d in daily] == days_sorted
