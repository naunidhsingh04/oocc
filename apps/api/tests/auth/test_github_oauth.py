"""GitHubOAuthClient exercised over an httpx2.MockTransport — no real
network call to github.com/api.github.com ever happens (see
app/auth/github_oauth.py's docstring). Separately, the full
`/api/auth/github/login` + `/api/auth/github/callback` router flow is
exercised against the FastAPI app with the same mock transport injected
via dependency_overrides.
"""

from __future__ import annotations

from typing import Any

import httpx2 as httpx
import pytest
from app.auth.github_oauth import GitHubOAuthClient
from app.auth.tokens import OAUTH_STATE_COOKIE_NAME
from app.auth.user_store import InMemoryUserStore
from app.main import app
from app.routers.auth import get_github_client, get_user_store
from fastapi.testclient import TestClient

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _fake_github_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json={"access_token": "gh-fake-token-123"})
        if request.url.path == "/user":
            return httpx.Response(
                200, json={"id": 42, "login": "octocat", "email": "octo@example.com"}
            )
        if request.url.path == "/user/emails":
            return httpx.Response(200, json=[{"email": "octo@example.com", "primary": True}])
        raise AssertionError(f"unexpected request to {request.url}")

    return httpx.MockTransport(handler)


async def test_exchange_code_and_fetch_user() -> None:
    client = GitHubOAuthClient(
        client_id="id", client_secret="secret", transport=_fake_github_transport()
    )
    token = await client.exchange_code(code="abc", redirect_uri="https://app.test/cb")
    assert token == "gh-fake-token-123"

    user = await client.fetch_user(access_token=token)
    assert user.github_id == "42"
    assert user.login == "octocat"
    assert user.email == "octo@example.com"
    await client.aclose()


async def test_fetch_user_falls_back_to_primary_email_endpoint() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 7, "login": "noemail", "email": None})
        if request.url.path == "/user/emails":
            return httpx.Response(
                200,
                json=[
                    {"email": "secondary@example.com", "primary": False},
                    {"email": "primary@example.com", "primary": True},
                ],
            )
        raise AssertionError("unexpected request")

    client = GitHubOAuthClient(transport=httpx.MockTransport(handler))
    user = await client.fetch_user(access_token="tok")
    assert user.email == "primary@example.com"
    await client.aclose()


def test_authorize_url_includes_state_and_redirect_uri() -> None:
    client = GitHubOAuthClient(client_id="my-client-id")
    url = client.authorize_url(redirect_uri="https://app.test/cb", state="xyz")
    assert "client_id=my-client-id" in url
    assert "state=xyz" in url
    assert "redirect_uri=https" in url


@pytest.fixture
def oauth_client() -> Any:
    user_store = InMemoryUserStore()
    fake_client = GitHubOAuthClient(transport=_fake_github_transport())

    app.dependency_overrides[get_github_client] = lambda: fake_client
    app.dependency_overrides[get_user_store] = lambda: user_store

    test_client = TestClient(app)
    test_client.user_store = user_store  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()


def test_login_redirects_and_sets_state_cookie(oauth_client: TestClient) -> None:
    response = oauth_client.get(
        "/api/auth/github/login",
        params={"redirect_uri": "https://app.test/cb"},
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert OAUTH_STATE_COOKIE_NAME in response.cookies


def test_callback_creates_a_user_and_session(oauth_client: TestClient) -> None:
    login_response = oauth_client.get(
        "/api/auth/github/login",
        params={"redirect_uri": "https://app.test/cb"},
        follow_redirects=False,
    )
    state = login_response.cookies[OAUTH_STATE_COOKIE_NAME]

    callback_response = oauth_client.get(
        "/api/auth/github/callback",
        params={"code": "abc", "state": state, "redirect_uri": "https://app.test/cb"},
    )
    assert callback_response.status_code == 200
    body = callback_response.json()
    assert body["user"]["handle"] == "octocat"
    assert "oocc_session" in callback_response.cookies


def test_callback_rejects_mismatched_state(oauth_client: TestClient) -> None:
    oauth_client.get(
        "/api/auth/github/login",
        params={"redirect_uri": "https://app.test/cb"},
        follow_redirects=False,
    )
    response = oauth_client.get(
        "/api/auth/github/callback",
        params={"code": "abc", "state": "wrong-state", "redirect_uri": "https://app.test/cb"},
    )
    assert response.status_code == 400
