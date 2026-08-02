"""The user's Gemini API key (`X-Provider-Key`, docs/PRD.md §4.5). Request-
scoped only: never written to Postgres, never logged, never echoed back in
a response, never sent anywhere but Google. `ProviderKey` wraps it in a
Pydantic `SecretStr` so that even an accidental `str(...)`/`repr(...)` or
a stray log call on the object itself (not just the raw string) renders as
`**********` instead of the key — defense in depth on top of
`app.logging.bind_sensitive_value`'s per-request scrub, which is the
primary mechanism and catches the raw string wherever it ends up.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from pydantic import SecretStr

from app.logging import bind_sensitive_value


@dataclass(frozen=True)
class ProviderKey:
    _secret: SecretStr | None

    @property
    def is_present(self) -> bool:
        return self._secret is not None

    def reveal(self) -> str:
        """The only way to get the raw key back out — call this exactly
        once, right before handing it to the Gemini client, never to log
        or store it."""
        if self._secret is None:
            raise RuntimeError("reveal() called with no provider key present")
        return self._secret.get_secret_value()

    def __repr__(self) -> str:
        return f"ProviderKey(present={self.is_present})"


def get_provider_key(request: Request) -> ProviderKey:
    """FastAPI dependency. Binds the raw header value for this request's
    log-redaction scope (see app.logging) before wrapping it — the scrub
    must be armed before anything else in this request has a chance to log
    it, including this very dependency's own return."""
    # Trimmed server-side too, not just by the frontend (lib/settings/store.ts)
    # — a pasted key's trailing newline surviving into the header would
    # otherwise make Gemini reject an otherwise-valid key with no
    # indication the whitespace was the cause.
    raw = request.headers.get("x-provider-key")
    stripped = raw.strip() if raw else None
    bind_sensitive_value(stripped)
    return ProviderKey(_secret=SecretStr(stripped) if stripped else None)
