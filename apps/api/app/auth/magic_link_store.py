"""Server-side single-use tracking for magic-link tokens
(migrations/0002_accounts_and_progress.sql's `magic_link_tokens`).
Signature + expiry alone (app.auth.tokens) prove a token is authentic and
not stale; they cannot prove it hasn't already been redeemed once, since
the signed payload is deterministic for a given email + issue time. This
store's whole job is that one bit: has this `token_hash` been consumed.

Same real/fake split as app/rag/concept_store.py's `ConceptStore`: no
Postgres is reachable in this dev sandbox, so `PostgresMagicLinkStore` is
exercised only by real deployment, and every test runs against
`InMemoryMagicLinkStore` through the identical `MagicLinkStore` protocol.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol


class MagicLinkStore(Protocol):
    async def mark_issued(self, *, token_hash: str, email: str, expires_at: datetime) -> None: ...

    async def redeem(self, *, token_hash: str) -> str | None:
        """Returns the email if `token_hash` is known, unused, and
        unexpired, atomically marking it used in the same operation.
        Returns None otherwise (unknown, already used, or expired — all
        indistinguishable to the caller, all just "not valid"), so a
        redeem endpoint never has to branch on *why* a token failed."""
        ...


@dataclass
class _Entry:
    email: str
    expires_at: datetime
    used: bool = False


class InMemoryMagicLinkStore:
    def __init__(self) -> None:
        self._entries: dict[str, _Entry] = {}

    async def mark_issued(self, *, token_hash: str, email: str, expires_at: datetime) -> None:
        self._entries[token_hash] = _Entry(email=email, expires_at=expires_at)

    async def redeem(self, *, token_hash: str) -> str | None:
        entry = self._entries.get(token_hash)
        if entry is None or entry.used:
            return None
        if entry.expires_at < datetime.now(UTC):
            return None
        entry.used = True
        return entry.email

    def __len__(self) -> int:
        return len(self._entries)


class PostgresMagicLinkStore:
    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def mark_issued(self, *, token_hash: str, email: str, expires_at: datetime) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO magic_link_tokens (token_hash, email, expires_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (token_hash) DO NOTHING
                """,
                token_hash,
                email,
                expires_at,
            )

    async def redeem(self, *, token_hash: str) -> str | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE magic_link_tokens
                SET used_at = now()
                WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
                RETURNING email
                """,
                token_hash,
            )
        return row["email"] if row else None
