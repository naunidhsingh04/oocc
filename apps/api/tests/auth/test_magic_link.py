"""End-to-end magic-link flow against the FastAPI app, with the Postgres-
backed stores and real SMTP sender swapped for their in-memory fakes via
FastAPI's dependency_overrides — no live Postgres or SMTP server is
reachable from this environment (see CLAUDE.md)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.auth.magic_link_store import InMemoryMagicLinkStore
from app.auth.mail import InMemoryMailSender
from app.auth.tokens import hash_token, issue_magic_link_token
from app.auth.user_store import InMemoryUserStore
from app.main import app
from app.routers.auth import get_magic_link_store, get_mail_sender, get_user_store
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

    app.dependency_overrides[get_mail_sender] = lambda: mail_sender
    app.dependency_overrides[get_magic_link_store] = lambda: magic_link_store
    app.dependency_overrides[get_user_store] = lambda: user_store

    test_client = TestClient(app)
    test_client.mail_sender = mail_sender  # type: ignore[attr-defined]
    test_client.magic_link_store = magic_link_store  # type: ignore[attr-defined]
    test_client.user_store = user_store  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()


def test_request_always_reports_sent(client: TestClient) -> None:
    response = client.post("/api/auth/magic-link/request", json={"email": "a@example.com"})
    assert response.status_code == 200
    assert response.json() == {"sent": True}

    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    assert len(mail_sender.sent) == 1
    assert mail_sender.sent[0].to == "a@example.com"


def test_redeem_creates_a_user_and_sets_session_cookie(client: TestClient) -> None:
    client.post("/api/auth/magic-link/request", json={"email": "new@example.com"})
    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    sent_body = mail_sender.sent[0].body
    token = sent_body.split("token=")[1].split("\n")[0]

    response = client.post("/api/auth/magic-link/redeem", json={"token": token})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "new@example.com"
    assert "oocc_session" in response.cookies

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "new@example.com"


def test_redeem_twice_fails_the_second_time(client: TestClient) -> None:
    client.post("/api/auth/magic-link/request", json={"email": "once@example.com"})
    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    token = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]

    first = client.post("/api/auth/magic-link/redeem", json={"token": token})
    assert first.status_code == 200

    second = client.post("/api/auth/magic-link/redeem", json={"token": token})
    assert second.status_code == 400


def test_redeem_with_bad_signature_fails(client: TestClient) -> None:
    response = client.post("/api/auth/magic-link/redeem", json={"token": "not-a-real-token"})
    assert response.status_code == 400


async def test_redeem_with_expired_token_fails(client: TestClient) -> None:
    magic_link_store: InMemoryMagicLinkStore = client.magic_link_store  # type: ignore[attr-defined]
    token = issue_magic_link_token("expired@example.com")
    await magic_link_store.mark_issued(
        token_hash=hash_token(token),
        email="expired@example.com",
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )

    response = client.post("/api/auth/magic-link/redeem", json={"token": token})
    assert response.status_code == 400


def test_returning_email_reuses_the_same_user(client: TestClient) -> None:
    client.post("/api/auth/magic-link/request", json={"email": "twice@example.com"})
    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    token_one = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]
    first = client.post("/api/auth/magic-link/redeem", json={"token": token_one})
    user_id_one = first.json()["user"]["id"]

    client.post("/api/auth/magic-link/request", json={"email": "twice@example.com"})
    token_two = mail_sender.sent[1].body.split("token=")[1].split("\n")[0]
    second = client.post("/api/auth/magic-link/redeem", json={"token": token_two})
    user_id_two = second.json()["user"]["id"]

    assert user_id_one == user_id_two


def test_me_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_session_is_200_with_null_user_when_signed_out(client: TestClient) -> None:
    # Unlike /api/auth/me (401 with no session, by design), /api/auth/session
    # exists precisely so a frontend can check "is anyone logged in" without
    # a 401 being the only signal — see the progress dashboard's use of it.
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json() == {"user": None}


def test_session_reports_the_signed_in_user(client: TestClient) -> None:
    client.post("/api/auth/magic-link/request", json={"email": "session@example.com"})
    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    token = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]
    client.post("/api/auth/magic-link/redeem", json={"token": token})

    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "session@example.com"


def test_logout_clears_the_session_cookie(client: TestClient) -> None:
    client.post("/api/auth/magic-link/request", json={"email": "logout@example.com"})
    mail_sender: InMemoryMailSender = client.mail_sender  # type: ignore[attr-defined]
    token = mail_sender.sent[0].body.split("token=")[1].split("\n")[0]
    client.post("/api/auth/magic-link/redeem", json={"token": token})

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 401
