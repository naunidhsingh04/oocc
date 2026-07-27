"""`progress/review_queue.py` (brief item 3): which concepts are due for
review for a user, right now. Deterministic — a filter and a sort over
already-computed `next_review_at` values, no LLM, no new state.
"""

from __future__ import annotations

from datetime import datetime

from app.progress.progress_store import ProgressRecord, ProgressStore


async def get_review_queue(
    *, user_id: str, store: ProgressStore, now: datetime
) -> list[ProgressRecord]:
    """Due concepts, most overdue first, ties broken by lowest mastery
    (a concept that's both overdue and weak is worth reviewing before one
    that's overdue but already nearly mastered)."""
    records = await store.list_for_user(user_id)
    due = [r for r in records if r.next_review_at is not None and r.next_review_at <= now]
    due.sort(key=lambda r: (r.next_review_at, r.mastery))
    return due
