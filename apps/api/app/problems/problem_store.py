"""`problems` table (docs/PRD.md §8,
migrations/0002_accounts_and_progress.sql). `tests` is a list of
`{"args": [...], "expected": <json>}` objects — see
apps/api/scripts/seed_problems.py for the 40 seeded problems and
app/problems/grading.py for how a submission is checked against them.
Same real/fake split as every other store in this codebase.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class Problem:
    id: str
    slug: str
    title: str
    difficulty: str
    tags: tuple[str, ...]
    statement_md: str
    starter_code: str
    tests: tuple[dict[str, Any], ...]


class ProblemStore(Protocol):
    async def list_all(self) -> list[Problem]: ...
    async def get_by_slug(self, slug: str) -> Problem | None: ...
    async def upsert(self, problem: Problem) -> None: ...


class InMemoryProblemStore:
    def __init__(self) -> None:
        self._by_slug: dict[str, Problem] = {}

    async def list_all(self) -> list[Problem]:
        return list(self._by_slug.values())

    async def get_by_slug(self, slug: str) -> Problem | None:
        return self._by_slug.get(slug)

    async def upsert(self, problem: Problem) -> None:
        self._by_slug[problem.slug] = problem

    def __len__(self) -> int:
        return len(self._by_slug)


class PostgresProblemStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @staticmethod
    def _row_to_problem(row: Any) -> Problem:
        tests = row["tests"]
        if isinstance(tests, str):
            tests = json.loads(tests)
        return Problem(
            id=row["id"],
            slug=row["slug"],
            title=row["title"],
            difficulty=row["difficulty"],
            tags=tuple(row["tags"] or ()),
            statement_md=row["statement_md"],
            starter_code=row["starter_code"],
            tests=tuple(tests),
        )

    async def list_all(self) -> list[Problem]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM problems ORDER BY id")
        return [self._row_to_problem(r) for r in rows]

    async def get_by_slug(self, slug: str) -> Problem | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM problems WHERE slug = $1", slug)
        return self._row_to_problem(row) if row else None

    async def upsert(self, problem: Problem) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO problems
                    (id, slug, title, difficulty, tags, statement_md, starter_code, tests)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE
                SET slug = EXCLUDED.slug,
                    title = EXCLUDED.title,
                    difficulty = EXCLUDED.difficulty,
                    tags = EXCLUDED.tags,
                    statement_md = EXCLUDED.statement_md,
                    starter_code = EXCLUDED.starter_code,
                    tests = EXCLUDED.tests
                """,
                problem.id,
                problem.slug,
                problem.title,
                problem.difficulty,
                list(problem.tags),
                problem.statement_md,
                problem.starter_code,
                json.dumps(problem.tests),
            )
