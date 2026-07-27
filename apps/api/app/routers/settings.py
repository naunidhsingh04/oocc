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
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.agents.llm_client import GeminiClient, LLMClient
from app.security import ProviderKey, get_provider_key

router = APIRouter()

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
    except Exception:  # noqa: BLE001 — any failure (bad key, network, quota) reads as "invalid"
        return ValidateKeyResponse(valid=False, error="invalid_key")

    return ValidateKeyResponse(valid=True, tokens_used=client.last_usage_tokens)
