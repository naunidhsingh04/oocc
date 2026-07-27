"""`progress` table (docs/PRD.md §8,
migrations/0002_accounts_and_progress.sql). Same real/fake split as every
other store in this codebase: `PostgresProgressStore` for real deployment,
`InMemoryProgressStore` for every test, both behind the `ProgressStore`
protocol.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass
class ProgressRecord:
    user_id: str
    concept_id: str
    mastery: float
    last_seen_at: datetime | None
    next_review_at: datetime | None


class ProgressStore(Protocol):
    async def get(self, *, user_id: str, concept_id: str) -> ProgressRecord | None: ...

    async def upsert(
        self,
        *,
        user_id: str,
        concept_id: str,
        mastery: float,
        last_seen_at: datetime,
        next_review_at: datetime,
    ) -> ProgressRecord: ...

    async def list_for_user(self, user_id: str) -> list[ProgressRecord]: ...


class InMemoryProgressStore:
    def __init__(self) -> None:
        self._rows: dict[tuple[str, str], ProgressRecord] = {}

    async def get(self, *, user_id: str, concept_id: str) -> ProgressRecord | None:
        return self._rows.get((user_id, concept_id))

    async def upsert(
        self,
        *,
        user_id: str,
        concept_id: str,
        mastery: float,
        last_seen_at: datetime,
        next_review_at: datetime,
    ) -> ProgressRecord:
        record = ProgressRecord(
            user_id=user_id,
            concept_id=concept_id,
            mastery=mastery,
            last_seen_at=last_seen_at,
            next_review_at=next_review_at,
        )
        self._rows[(user_id, concept_id)] = record
        return record

    async def list_for_user(self, user_id: str) -> list[ProgressRecord]:
        return [r for (uid, _cid), r in self._rows.items() if uid == user_id]

    def __len__(self) -> int:
        return len(self._rows)


class PostgresProgressStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @staticmethod
    def _row_to_record(row: Any) -> ProgressRecord:
        return ProgressRecord(
            user_id=row["user_id"],
            concept_id=row["concept_id"],
            mastery=row["mastery"],
            last_seen_at=row["last_seen_at"],
            next_review_at=row["next_review_at"],
        )

    async def get(self, *, user_id: str, concept_id: str) -> ProgressRecord | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM progress WHERE user_id = $1 AND concept_id = $2",
                user_id,
                concept_id,
            )
        return self._row_to_record(row) if row else None

    async def upsert(
        self,
        *,
        user_id: str,
        concept_id: str,
        mastery: float,
        last_seen_at: datetime,
        next_review_at: datetime,
    ) -> ProgressRecord:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO progress (user_id, concept_id, mastery, last_seen_at, next_review_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, concept_id) DO UPDATE
                SET mastery = EXCLUDED.mastery,
                    last_seen_at = EXCLUDED.last_seen_at,
                    next_review_at = EXCLUDED.next_review_at
                RETURNING *
                """,
                user_id,
                concept_id,
                mastery,
                last_seen_at,
                next_review_at,
            )
        assert row is not None
        return self._row_to_record(row)

    async def list_for_user(self, user_id: str) -> list[ProgressRecord]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM progress WHERE user_id = $1", user_id)
        return [self._row_to_record(r) for r in rows]
