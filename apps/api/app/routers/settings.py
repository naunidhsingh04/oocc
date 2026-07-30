"""POST /api/settings/validate-key — Phase 3 frontend's key-setup surface
needs to "validate on entry and show the result" (not just accept anything
that looks key-shaped). Makes one minimal, cheap Gemini call
(`thinking_budget: 0`, a two-token prompt) and reports whether it
succeeded, plus the token cost of that one validation call, entirely so the
frontend never has to guess a key is good until the *first real* tutor
question fails.

Same request-scoped-key rules as everywhere else (PRD §4.5): the key
reaches this handler only via `ProviderKey`, is never logged, and any
upstream error is reported as a generic reason string, never the SDK
exception's own message (which could echo request internals).

`error` is one of `no_key` / `invalid_key` / `rate_limited` /
`upstream_unavailable` — not just a blanket "invalid_key" for every
failure. A real key that fails because Gemini is unreachable, rate-limited,
or having an outage used to read identically to a genuinely bad key, which
made a live deploy issue indistinguishable from a typo; only an HTTP
4xx from Gemini itself (bad/revoked key, or a request Gemini itself
rejects) is reported as `invalid_key` now. Every branch logs the
exception's *type and status code only* (never `str(exc)`, which is the
one piece of this SDK's own error message that could echo request
internals) so a real production failure is diagnosable from server logs
without the frontend or this response ever carrying more detail than a
generic reason string.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.agents.llm_client import GeminiClient, LLMClient
from app.security import ProviderKey, get_provider_key

router = APIRouter()
logger = structlog.get_logger("oocc.api")

_VALIDATION_SCHEMA = {
    "type": "object",
    "properties": {"ok": {"type": "boolean"}},
    "required": ["ok"],
}


class ValidateKeyResponse(BaseModel):
    valid: bool
    tokens_used: int | None = None
    error: str | None = None


def get_llm_client_for_settings(
    provider_key: ProviderKey = Depends(get_provider_key),
) -> LLMClient | None:
    if not provider_key.is_present:
        return None
    return GeminiClient(provider_key.reveal())


@router.post("/api/settings/validate-key")
async def validate_key(
    client: LLMClient | None = Depends(get_llm_client_for_settings),
) -> ValidateKeyResponse:
    if client is None:
        return ValidateKeyResponse(valid=False, error="no_key")

    try:
        await client.generate_json(
            system='Reply with {"ok": true} and nothing else.',
            prompt="ping",
            response_schema=_VALIDATION_SCHEMA,
            thinking_budget=0,
        )
    except Exception as exc:  # noqa: BLE001 — every failure path logs+reports below, none re-raise
        # Imported lazily, matching `GeminiClient.__init__`'s own reasoning
        # (app/agents/llm_client.py) — this module shouldn't force a
        # google-genai import just to be collected by a FakeLLMClient-only
        # test.
        from google.genai.errors import ClientError

        if isinstance(exc, ClientError) and exc.code == 429:
            error = "rate_limited"
        elif isinstance(exc, ClientError):
            # Any other 4xx from Gemini itself: bad/revoked key, or a
            # request Gemini rejects outright — the only case a real,
            # working key should never land in.
            error = "invalid_key"
        else:
            # Network failure, 5xx, timeout — Gemini/the network is the
            # problem, not necessarily the key.
            error = "upstream_unavailable"

        logger.warning(
            "settings.validate_key_failed",
            error=error,
            exception_type=type(exc).__name__,
            status_code=getattr(exc, "code", None),
        )
        return ValidateKeyResponse(valid=False, error=error)

    return ValidateKeyResponse(valid=True, tokens_used=client.last_usage_tokens)
