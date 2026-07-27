"""`users` table (docs/PRD.md §8,
migrations/0002_accounts_and_progress.sql). Same real/fake split as
app/rag/concept_store.py: `PostgresUserStore` for real deployment,
`InMemoryUserStore` for every test, both behind the `UserStore` protocol.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Protocol


@dataclass
class User:
    id: str
    handle: str
    email: str | None
    github_id: str | None
    created_at: datetime
    settings: dict[str, Any] = field(default_factory=dict)


class UserStore(Protocol):
    async def get_by_id(self, user_id: str) -> User | None: ...
    async def get_by_email(self, email: str) -> User | None: ...
    async def get_by_github_id(self, github_id: str) -> User | None: ...
    async def create(self, *, handle: str, email: str | None, github_id: str | None) -> User: ...


def new_user_id() -> str:
    return f"u_{uuid.uuid4().hex[:16]}"


class InMemoryUserStore:
    def __init__(self) -> None:
        self._by_id: dict[str, User] = {}

    async def get_by_id(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)

    async def get_by_email(self, email: str) -> User | None:
        return next((u for u in self._by_id.values() if u.email == email), None)

    async def get_by_github_id(self, github_id: str) -> User | None:
        return next((u for u in self._by_id.values() if u.github_id == github_id), None)

    async def create(self, *, handle: str, email: str | None, github_id: str | None) -> User:
        user = User(
            id=new_user_id(),
            handle=handle,
            email=email,
            github_id=github_id,
            created_at=datetime.now(UTC),
            settings={},
        )
        self._by_id[user.id] = user
        return user

    def __len__(self) -> int:
        return len(self._by_id)


class PostgresUserStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @staticmethod
    def _row_to_user(row: Any) -> User:
        settings = row["settings"]
        if isinstance(settings, str):
            settings = json.loads(settings)
        return User(
            id=row["id"],
            handle=row["handle"],
            email=row["email"],
            github_id=row["github_id"],
            created_at=row["created_at"],
            settings=settings or {},
        )

    async def get_by_id(self, user_id: str) -> User | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return self._row_to_user(row) if row else None

    async def get_by_email(self, email: str) -> User | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)
        return self._row_to_user(row) if row else None

    async def get_by_github_id(self, github_id: str) -> User | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE github_id = $1", github_id)
        return self._row_to_user(row) if row else None

    async def create(self, *, handle: str, email: str | None, github_id: str | None) -> User:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO users (id, handle, email, github_id, settings)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                """,
                new_user_id(),
                handle,
                email,
                github_id,
                json.dumps({}),
            )
        assert row is not None
        return self._row_to_user(row)
