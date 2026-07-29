"""docs/AUDIT.md Pass 4: `GET /api/progress` and `GET /api/progress/
review-queue` were verified live to 401 without a session, but nothing in
the suite asserted it — a regression here would have gone uncaught. Closes
that gap directly."""

from __future__ import annotations

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_progress_requires_authentication() -> None:
    response = client.get("/api/progress")
    assert response.status_code == 401


def test_review_queue_requires_authentication() -> None:
    response = client.get("/api/progress/review-queue")
    assert response.status_code == 401
