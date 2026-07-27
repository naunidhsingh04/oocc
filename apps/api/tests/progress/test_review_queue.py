"""app/progress/review_queue.py against InMemoryProgressStore — the same
real/fake split every other store in this codebase uses; no Postgres is
reachable here (see CLAUDE.md)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.progress.progress_store import InMemoryProgressStore
from app.progress.review_queue import get_review_queue

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_only_due_concepts_are_returned() -> None:
    store = InMemoryProgressStore()
    now = datetime(2026, 1, 10, tzinfo=UTC)
    await store.upsert(
        user_id="u1",
        concept_id="overdue",
        mastery=0.5,
        last_seen_at=now - timedelta(days=5),
        next_review_at=now - timedelta(days=1),
    )
    await store.upsert(
        user_id="u1",
        concept_id="not-due-yet",
        mastery=0.9,
        last_seen_at=now - timedelta(days=1),
        next_review_at=now + timedelta(days=10),
    )

    due = await get_review_queue(user_id="u1", store=store, now=now)

    assert [r.concept_id for r in due] == ["overdue"]


async def test_most_overdue_and_weakest_come_first() -> None:
    store = InMemoryProgressStore()
    now = datetime(2026, 1, 10, tzinfo=UTC)
    await store.upsert(
        user_id="u1",
        concept_id="slightly-overdue",
        mastery=0.9,
        last_seen_at=now - timedelta(days=2),
        next_review_at=now - timedelta(hours=1),
    )
    await store.upsert(
        user_id="u1",
        concept_id="very-overdue",
        mastery=0.2,
        last_seen_at=now - timedelta(days=20),
        next_review_at=now - timedelta(days=15),
    )

    due = await get_review_queue(user_id="u1", store=store, now=now)

    assert [r.concept_id for r in due] == ["very-overdue", "slightly-overdue"]


async def test_a_different_users_progress_is_never_returned() -> None:
    store = InMemoryProgressStore()
    now = datetime(2026, 1, 10, tzinfo=UTC)
    await store.upsert(
        user_id="other-user",
        concept_id="overdue",
        mastery=0.1,
        last_seen_at=now - timedelta(days=5),
        next_review_at=now - timedelta(days=1),
    )

    due = await get_review_queue(user_id="u1", store=store, now=now)

    assert due == []
