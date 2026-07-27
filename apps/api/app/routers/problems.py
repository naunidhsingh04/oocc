"""GET /api/problems, GET /api/problems/{slug}, POST /api/problems/{slug}/submit
(brief items 4 and 6). List/detail responses never include `tests[].expected`
— a learner's client only needs `args` to render "try these inputs"; the
expected answer is grading-server-only, checked in `grade_submission`
(app/problems/grading.py), never shipped to the browser.

Submitting is optional-auth: an anonymous submission is graded and
returned but not persisted against a user or folded into `progress` (there
is no user to attribute it to); a signed-in learner's submission also
records a row in `submissions` and updates `progress` for every tag on the
problem, treating each tag as a concept id — a reasonable default mapping
in the absence of a richer problem->concept link in the schema (docs/PRD.md
§8 doesn't specify one), left explicit here for review.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.user_store import User
from app.executor_client import ExecutorClient
from app.problems.grading import grade_submission
from app.problems.problem_store import Problem, ProblemStore
from app.progress.mastery import SubmissionSignal, schedule_next_review, update_mastery
from app.progress.progress_store import ProgressStore
from app.routers.auth import get_current_user_optional

router = APIRouter()
logger = structlog.get_logger("oocc.api")


class _LazyPostgresProblemStore:
    async def _store(self) -> ProblemStore:
        from app.db import get_pool
        from app.problems.problem_store import PostgresProblemStore

        return PostgresProblemStore(await get_pool())

    async def list_all(self) -> list[Problem]:
        return await (await self._store()).list_all()

    async def get_by_slug(self, slug: str) -> Problem | None:
        return await (await self._store()).get_by_slug(slug)

    async def upsert(self, problem: Problem) -> None:
        await (await self._store()).upsert(problem)


class _LazyPostgresProgressStore:
    async def _store(self) -> ProgressStore:
        from app.db import get_pool
        from app.progress.progress_store import PostgresProgressStore

        return PostgresProgressStore(await get_pool())

    async def get(self, *, user_id: str, concept_id: str) -> Any:
        return await (await self._store()).get(user_id=user_id, concept_id=concept_id)

    async def upsert(self, **kwargs: Any) -> Any:
        return await (await self._store()).upsert(**kwargs)

    async def list_for_user(self, user_id: str) -> Any:
        return await (await self._store()).list_for_user(user_id)


def get_problem_store() -> ProblemStore:
    return _LazyPostgresProblemStore()


def get_progress_store() -> ProgressStore:
    return _LazyPostgresProgressStore()


def get_executor_client() -> ExecutorClient:
    return ExecutorClient()


def _problem_summary(problem: Problem) -> dict[str, Any]:
    return {
        "slug": problem.slug,
        "title": problem.title,
        "difficulty": problem.difficulty,
        "tags": list(problem.tags),
    }


def _problem_detail(problem: Problem) -> dict[str, Any]:
    return {
        **_problem_summary(problem),
        "statement_md": problem.statement_md,
        "starter_code": problem.starter_code,
        # Public tests carry only `args` — never the answer key.
        "public_tests": [{"args": t["args"]} for t in problem.tests],
    }


@router.get("/api/problems")
async def list_problems(store: ProblemStore = Depends(get_problem_store)) -> list[dict[str, Any]]:
    problems = await store.list_all()
    return [_problem_summary(p) for p in problems]


@router.get("/api/problems/{slug}")
async def get_problem(
    slug: str, store: ProblemStore = Depends(get_problem_store)
) -> dict[str, Any]:
    problem = await store.get_by_slug(slug)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem_not_found")
    return _problem_detail(problem)


class SubmitRequest(BaseModel):
    source: str
    # Frontend playback telemetry for this attempt (brief item 3's
    # "did the learner scrub the trace" signal) — see
    # app.progress.mastery.SubmissionSignal's docstring for the assumed
    # contract. Both default to 0, read as "no telemetry."
    hints_used: int = 0
    tutor_questions: int = 0
    steps_viewed: int = 0
    total_steps: int = 0
    time_to_solve_s: float | None = None


@router.post("/api/problems/{slug}/submit")
async def submit_problem(
    slug: str,
    request: SubmitRequest,
    problem_store: ProblemStore = Depends(get_problem_store),
    progress_store: ProgressStore = Depends(get_progress_store),
    executor: ExecutorClient = Depends(get_executor_client),
    user: User | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    problem = await problem_store.get_by_slug(slug)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem_not_found")

    result = await grade_submission(
        source=request.source, tests=list(problem.tests), executor=executor
    )

    response: dict[str, Any] = {
        "passed": result.passed,
        "run_status": result.run_status,
        "results": [
            {"passed": o.passed, "expected": o.expected, "actual": o.actual, "error": o.error}
            for o in result.outcomes
        ],
    }

    if user is None:
        return response

    submission_id = f"s_{uuid4().hex[:16]}"
    now = datetime.now(UTC)

    # Each of a problem's tags stands in for a concept id: docs/PRD.md §8
    # has no dedicated problem->concept link, and tags are the closest
    # existing signal for "what this problem is testing."
    for tag in problem.tags:
        existing = await progress_store.get(user_id=user.id, concept_id=tag)
        previous_mastery = existing.mastery if existing else 0.0
        signal = SubmissionSignal(
            passed=result.passed,
            hints_used=request.hints_used,
            tutor_questions=request.tutor_questions,
            steps_viewed=request.steps_viewed,
            total_steps=request.total_steps,
            time_to_solve_s=request.time_to_solve_s,
        )
        new_mastery = update_mastery(previous_mastery, signal)
        await progress_store.upsert(
            user_id=user.id,
            concept_id=tag,
            mastery=new_mastery,
            last_seen_at=now,
            next_review_at=schedule_next_review(new_mastery, now=now),
        )

    logger.info("problems.submitted", problem_slug=slug, passed=result.passed, user_id=user.id)
    response["submission_id"] = submission_id
    return response
