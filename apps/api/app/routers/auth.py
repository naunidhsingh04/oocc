"""Auth endpoints (brief item 2): email magic link + GitHub OAuth, both
resolving to the same stateless session cookie (app/auth/tokens.py).

Magic link: `POST /api/auth/magic-link/request` always answers `{"sent":
true}` regardless of whether the email is registered — this is the
standard anti-enumeration shape (a real inbox gets a link; a stranger's
"did this work?" probe learns nothing). The user row is created lazily on
redeem, not on request, so a flood of request calls can't populate the
`users` table.

GitHub OAuth: `state` is a random token round-tripped through a short-lived
signed cookie (`oocc_oauth_state`) rather than server-side storage — it
only needs to survive one redirect, so a stateless cookie is enough, same
reasoning as the session cookie itself.

Every secret this router touches (magic-link token, GitHub access token,
session token) is bound via `app.logging.bind_sensitive_value` the instant
it's read off the wire, before any log call downstream — see
app/logging.py's docstring and tests/auth/test_token_redaction.py.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.auth.github_oauth import GitHubOAuthClient
from app.auth.magic_link_store import MagicLinkStore, PostgresMagicLinkStore
from app.auth.mail import MailSender, SmtpMailSender
from app.auth.tokens import (
    MAGIC_LINK_MAX_AGE_S,
    OAUTH_STATE_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_S,
    hash_token,
    issue_magic_link_token,
    issue_session_token,
    read_magic_link_token,
    read_session_token,
)
from app.auth.user_store import User, UserStore, new_user_id
from app.logging import bind_sensitive_value

router = APIRouter()
logger = structlog.get_logger("oocc.api")


def _set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_token,
        max_age=SESSION_MAX_AGE_S,
        httponly=True,
        samesite="lax",
    )


class _LazyPostgresUserStore:
    """Same "don't connect until a request actually needs it" shape as
    app/routers/tutor.py's `_LazyPostgresConceptStore`."""

    async def _store(self) -> UserStore:
        from app.auth.user_store import PostgresUserStore
        from app.db import get_pool

        return PostgresUserStore(await get_pool())

    async def get_by_id(self, user_id: str) -> User | None:
        return await (await self._store()).get_by_id(user_id)

    async def get_by_email(self, email: str) -> User | None:
        return await (await self._store()).get_by_email(email)

    async def get_by_github_id(self, github_id: str) -> User | None:
        return await (await self._store()).get_by_github_id(github_id)

    async def create(self, *, handle: str, email: str | None, github_id: str | None) -> User:
        return await (await self._store()).create(handle=handle, email=email, github_id=github_id)


class _LazyPostgresMagicLinkStore:
    async def _store(self) -> MagicLinkStore:
        from app.db import get_pool

        return PostgresMagicLinkStore(await get_pool())

    async def mark_issued(self, *, token_hash: str, email: str, expires_at: datetime) -> None:
        await (await self._store()).mark_issued(
            token_hash=token_hash, email=email, expires_at=expires_at
        )

    async def redeem(self, *, token_hash: str) -> str | None:
        return await (await self._store()).redeem(token_hash=token_hash)


def get_user_store() -> UserStore:
    return _LazyPostgresUserStore()


def get_magic_link_store() -> MagicLinkStore:
    return _LazyPostgresMagicLinkStore()


def get_mail_sender() -> MailSender:
    return SmtpMailSender()


def get_github_client() -> GitHubOAuthClient:
    return GitHubOAuthClient()


async def get_current_user_optional(
    request: Request, user_store: UserStore = Depends(get_user_store)
) -> User | None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    bind_sensitive_value(token)
    user_id = read_session_token(token)
    if user_id is None:
        return None
    return await user_store.get_by_id(user_id)


async def get_current_user(user: User | None = Depends(get_current_user_optional)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="not_authenticated")
    return user


def _user_out(user: User) -> dict[str, Any]:
    return {"id": user.id, "handle": user.handle, "email": user.email}


def _handle_from_email(email: str) -> str:
    local = email.split("@", 1)[0].strip().lower()
    cleaned = "".join(ch for ch in local if ch.isalnum() or ch in "-_") or "user"
    return f"{cleaned}-{secrets.token_hex(3)}"


async def _get_or_create_by_email(email: str, user_store: UserStore) -> User:
    existing = await user_store.get_by_email(email)
    if existing is not None:
        return existing
    return await user_store.create(handle=_handle_from_email(email), email=email, github_id=None)


class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkRequestResponse(BaseModel):
    sent: bool = True


@router.post("/api/auth/magic-link/request")
async def request_magic_link(
    request: MagicLinkRequest,
    magic_link_store: MagicLinkStore = Depends(get_magic_link_store),
    mail_sender: MailSender = Depends(get_mail_sender),
) -> MagicLinkRequestResponse:
    token = issue_magic_link_token(request.email)
    bind_sensitive_value(token)

    expires_at = datetime.now(UTC) + timedelta(seconds=MAGIC_LINK_MAX_AGE_S)
    await magic_link_store.mark_issued(
        token_hash=hash_token(token), email=request.email, expires_at=expires_at
    )
    await mail_sender.send(
        to=request.email,
        subject="Sign in to OOCC",
        body=f"Click to sign in: /auth/magic-link?token={token}\nThis link expires in 15 minutes.",
    )
    logger.info("auth.magic_link_requested")
    return MagicLinkRequestResponse()


class MagicLinkRedeem(BaseModel):
    token: str


@router.post("/api/auth/magic-link/redeem")
async def redeem_magic_link(
    request: MagicLinkRedeem,
    response: Response,
    magic_link_store: MagicLinkStore = Depends(get_magic_link_store),
    user_store: UserStore = Depends(get_user_store),
) -> dict[str, Any]:
    bind_sensitive_value(request.token)

    email = read_magic_link_token(request.token)
    if email is None:
        raise HTTPException(status_code=400, detail="invalid_or_expired_token")

    redeemed_email = await magic_link_store.redeem(token_hash=hash_token(request.token))
    if redeemed_email is None:
        raise HTTPException(status_code=400, detail="token_already_used_or_unknown")

    user = await _get_or_create_by_email(redeemed_email, user_store)
    session_token = issue_session_token(user.id)
    bind_sensitive_value(session_token)
    # httponly cookie only — never echo the session token in the JSON
    # body, or an XSS bug anywhere on the frontend can read it straight
    # back out and defeat the point of httponly.
    _set_session_cookie(response, session_token)

    logger.info("auth.magic_link_redeemed", user_id=user.id)
    return {"user": _user_out(user)}


@router.get("/api/auth/github/login")
async def github_login(
    redirect_uri: str, github_client: GitHubOAuthClient = Depends(get_github_client)
) -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    url = github_client.authorize_url(redirect_uri=redirect_uri, state=state)
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(OAUTH_STATE_COOKIE_NAME, state, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/api/auth/github/callback")
async def github_callback(
    request: Request,
    response: Response,
    code: str,
    state: str,
    redirect_uri: str,
    github_client: GitHubOAuthClient = Depends(get_github_client),
    user_store: UserStore = Depends(get_user_store),
) -> dict[str, Any]:
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    if not expected_state or not secrets.compare_digest(expected_state, state):
        raise HTTPException(status_code=400, detail="invalid_oauth_state")

    access_token = await github_client.exchange_code(code=code, redirect_uri=redirect_uri)
    bind_sensitive_value(access_token)

    github_user = await github_client.fetch_user(access_token=access_token)

    user = await user_store.get_by_github_id(github_user.github_id)
    if user is None and github_user.email:
        # Link to an existing magic-link account with the same verified
        # email rather than creating a duplicate user.
        user = await user_store.get_by_email(github_user.email)
    if user is None:
        handle = github_user.login or f"user-{new_user_id()[2:8]}"
        user = await user_store.create(
            handle=handle, email=github_user.email, github_id=github_user.github_id
        )

    session_token = issue_session_token(user.id)
    bind_sensitive_value(session_token)
    _set_session_cookie(response, session_token)

    logger.info("auth.github_login", user_id=user.id)
    return {"user": _user_out(user)}


@router.post("/api/auth/logout")
async def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"ok": True}


@router.get("/api/auth/me")
async def me(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return _user_out(user)
