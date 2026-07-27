"""GET /api/progress, GET /api/progress/review-queue (brief item 3). Both
require a session — progress is per-user and there's no meaningful
anonymous view of it, unlike problems (which are freely readable) or runs.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends

from app.auth.user_store import User
from app.progress.progress_store import ProgressStore
from app.progress.review_queue import get_review_queue
from app.routers.auth import get_current_user
from app.routers.problems import get_progress_store

router = APIRouter()


def _record_out(record: Any) -> dict[str, Any]:
    return {
        "concept_id": record.concept_id,
        "mastery": record.mastery,
        "last_seen_at": record.last_seen_at.isoformat() if record.last_seen_at else None,
        "next_review_at": record.next_review_at.isoformat() if record.next_review_at else None,
    }


@router.get("/api/progress")
async def list_progress(
    user: User = Depends(get_current_user),
    store: ProgressStore = Depends(get_progress_store),
) -> list[dict[str, Any]]:
    records = await store.list_for_user(user.id)
    return [_record_out(r) for r in records]


@router.get("/api/progress/review-queue")
async def review_queue(
    user: User = Depends(get_current_user),
    store: ProgressStore = Depends(get_progress_store),
) -> list[dict[str, Any]]:
    due = await get_review_queue(user_id=user.id, store=store, now=datetime.now(UTC))
    return [_record_out(r) for r in due]
