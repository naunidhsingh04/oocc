"""GitHub OAuth authorization-code exchange (brief item 2). Both HTTP
calls (code -> access_token, access_token -> user profile) go through one
injectable `httpx2.AsyncClient`, exactly like app.executor_client's
ExecutorClient: production points at the real github.com/api.github.com
hosts, tests substitute an `httpx2.MockTransport` so no real network call
ever happens. GitHub isn't an ASGI app we can mount in-process the way
services/executor is (see apps/api/tests/conftest.py's `executor_client`
fixture), so a mock transport rather than an ASGITransport is the
equivalent trick here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx2 as httpx

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
DEFAULT_TOKEN_URL = "https://github.com/login/oauth/access_token"
DEFAULT_API_BASE = "https://api.github.com"


@dataclass(frozen=True)
class GitHubUser:
    github_id: str
    login: str
    email: str | None


class GitHubOAuthClient:
    def __init__(
        self,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        token_url: str = DEFAULT_TOKEN_URL,
        api_base: str = DEFAULT_API_BASE,
    ) -> None:
        self._client_id = client_id or os.environ.get("GITHUB_CLIENT_ID", "")
        self._client_secret = client_secret or os.environ.get("GITHUB_CLIENT_SECRET", "")
        self._token_url = token_url
        self._api_base = api_base
        self._client = httpx.AsyncClient(transport=transport)

    def authorize_url(self, *, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "read:user user:email",
        }
        return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, *, code: str, redirect_uri: str) -> str:
        """Returns the access token. Never logged — callers must
        `app.logging.bind_sensitive_value` it immediately, the same
        discipline as X-Provider-Key (docs/PRD.md §4.5), and pass it
        nowhere but straight into `fetch_user`."""
        response = await self._client.post(
            self._token_url,
            data={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("access_token")
        if not isinstance(token, str):
            raise RuntimeError("github token exchange returned no access_token")
        return token

    async def fetch_user(self, *, access_token: str) -> GitHubUser:
        response = await self._client.get(
            f"{self._api_base}/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        data = response.json()
        email = data.get("email")
        if not email:
            email = await self._fetch_primary_email(access_token)
        return GitHubUser(github_id=str(data["id"]), login=data["login"], email=email)

    async def _fetch_primary_email(self, access_token: str) -> str | None:
        # A user's GitHub profile email can be private; the emails
        # endpoint is the only reliable way to get one to link the
        # account against docs/PRD.md §8's `users.email`.
        response = await self._client.get(
            f"{self._api_base}/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code != 200:
            return None
        for entry in response.json():
            if entry.get("primary"):
                email = entry.get("email")
                return email if isinstance(email, str) else None
        return None

    async def aclose(self) -> None:
        await self._client.aclose()
