"""Every new secret type this track introduces (magic-link token, session
token, GitHub access token) follows the same discipline as X-Provider-Key
(docs/PRD.md §4.5, app/logging.py): never logged.

Two complementary checks per token type:
1. The full request/response flow that carries the token never puts it in
   any log record — the same regression net as
   tests/test_logging_redaction.py.
2. `bind_sensitive_value` really does neutralize that exact value if
   something *were* to log it — necessary because, unlike X-Provider-Key
   (always a header, so `app/main.py`'s request-logging middleware puts it
   in a log record on literally every request), the magic-link token only
   ever travels in a JSON body and the GitHub access token only ever
   travels between this server and GitHub — neither naturally appears in
   any log line today. Check 1 alone can't distinguish "the mechanism
   works" from "nothing currently happens to log it"; check 2 closes that
   gap directly.
"""

from __future__ import annotations

import io

import httpx2 as httpx
import pytest
import structlog
from app.auth.github_oauth import GitHubOAuthClient
from app.auth.magic_link_store import InMemoryMagicLinkStore
from app.auth.mail import InMemoryMailSender
from app.auth.tokens import issue_session_token
from app.auth.user_store import InMemoryUserStore
from app.logging import bind_sensitive_value, configure_logging
from app.main import app
from app.routers.auth import (
    get_github_client,
    get_magic_link_store,
    get_mail_sender,
    get_user_store,
)
from fastapi.testclient import TestClient

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def client() -> TestClient:
    mail_sender = InMemoryMailSender()
    magic_link_store = InMemoryMagicLinkStore()
    user_store = InMemoryUserStore()

    def fake_github_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/login/oauth/access_token":
            return httpx.Response(
                200, json={"access_token": "gh-super-secret-access-token-do-not-log"}
            )
        return httpx.Response(200, json={"id": 1, "login": "octocat", "email": "o@example.com"})

    app.dependency_overrides[get_mail_sender] = lambda: mail_sender
    app.dependency_overrides[get_magic_link_store] = lambda: magic_link_store
    app.dependency_overrides[get_user_store] = lambda: user_store
    app.dependency_overrides[get_github_client] = lambda: GitHubOAuthClient(
        transport=httpx.MockTransport(fake_github_handler)
    )

    test_client = TestClient(app)
    test_client.mail_sender = mail_sender  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()


def _bind_then_log_would_redact(secret: str) -> bool:
    """Direct check of the mechanism itself: bind `secret` as this
    (synchronous, single-threaded) test's sensitive value, log it, and
    confirm the rendered record shows `[redacted]` instead of the raw
    value — the same contextvar-scoped pipeline app/main.py's middleware
    and app/routers/auth.py rely on."""
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        bind_sensitive_value(secret)
        structlog.get_logger("oocc.api.test").info("test.secret_logged", value=secret)
        logged_text = log_stream.getvalue()
        return secret not in logged_text and "[redacted]" in logged_text
    finally:
        configure_logging()


def test_magic_link_token_never_reaches_a_log_record(client: TestClient) -> None:
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        client.post("/api/auth/magic-link/request", json={"email": "secret@example.com"})
        mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
        token = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]

        response = client.post("/api/auth/magic-link/redeem", json={"token": token})
        assert response.status_code == 200

        logged_text = log_stream.getvalue()
        assert logged_text, "expected at least one log record to have been written"
        assert token not in logged_text

        assert _bind_then_log_would_redact(token)
    finally:
        configure_logging()


def test_session_token_never_reaches_a_log_record(client: TestClient) -> None:
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        client.post("/api/auth/magic-link/request", json={"email": "session@example.com"})
        mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
        token = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]
        redeem_response = client.post("/api/auth/magic-link/redeem", json={"token": token})
        session_token = redeem_response.cookies["oocc_session"]

        # A request that carries the session cookie must not leak it into
        # a log record either — request.completed logs every incoming
        # header via app/main.py's log_requests middleware, and the cookie
        # is bound there before that log call (see main.py's docstring).
        client.get("/api/auth/me")

        logged_text = log_stream.getvalue()
        assert session_token not in logged_text
        assert "[redacted]" in logged_text
    finally:
        configure_logging()


def test_a_session_token_that_never_travelled_this_request_still_redacts() -> None:
    # Belt-and-suspenders on the mechanism itself, independent of any
    # particular request happening to carry the cookie.
    token = issue_session_token("u_test123")
    assert _bind_then_log_would_redact(token)


def test_github_access_token_never_reaches_a_log_record(client: TestClient) -> None:
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        login_response = client.get(
            "/api/auth/github/login",
            params={"redirect_uri": "https://app.test/cb"},
            follow_redirects=False,
        )
        state = login_response.cookies["oocc_oauth_state"]
        response = client.get(
            "/api/auth/github/callback",
            params={"code": "abc", "state": state, "redirect_uri": "https://app.test/cb"},
        )
        assert response.status_code == 200

        logged_text = log_stream.getvalue()
        assert "gh-super-secret-access-token-do-not-log" not in logged_text

        assert _bind_then_log_would_redact("gh-super-secret-access-token-do-not-log")
    finally:
        configure_logging()
