"""The one seam every LLM-calling node goes through (docs/PRD.md §2.1,
§4.5): Gemini 2.5 Flash via the user's own `X-Provider-Key`, never a
platform key, never cached across requests. `LLMClient` is a `Protocol` so
every agent node depends on the interface, not on `google-genai` directly —
tests substitute `FakeLLMClient`, production code constructs `GeminiClient`
fresh per request from `ProviderKey.reveal()` (see app/security.py) and
never logs or stores the key itself.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Protocol

GEMINI_MODEL = "gemini-2.5-flash"


class LLMClient(Protocol):
    #: Total tokens billed by the most recent call on this client instance
    #: (`None` until at least one real call completes) — surfaced to the
    #: frontend's running session token count (Phase 3 frontend spec item
    #: 1). A fresh `LLMClient` is constructed per request (see
    #: app/security.py's `ProviderKey`), so this is per-*request* usage;
    #: the frontend accumulates it into a session total client-side.
    last_usage_tokens: int | None

    async def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        response_schema: dict[str, Any],
        thinking_budget: int = 0,
    ) -> dict[str, Any]:
        """Structured output, `thinking_budget: 0` for classification-style
        calls per PRD §4.3/§4.4."""
        ...

    def stream_text(
        self, *, system: str, prompt: str, thinking_budget: int = 1024
    ) -> AsyncIterator[str]:
        """The tutor's only streaming call, `thinking_budget: 1024`."""
        ...


class GeminiClient:
    def __init__(self, api_key: str, *, model: str = GEMINI_MODEL) -> None:
        # Imported lazily so importing this module (and therefore
        # `LLMClient`, used pervasively for typing) never requires the
        # google-genai package to have credentials configured, and so
        # FakeLLMClient-only test runs don't pay the import cost.
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model
        self.last_usage_tokens: int | None = None

    async def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        response_schema: dict[str, Any],
        thinking_budget: int = 0,
    ) -> dict[str, Any]:
        from google.genai import types

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_json_schema=response_schema,
                thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
            ),
        )
        if response.usage_metadata is not None:
            self.last_usage_tokens = response.usage_metadata.total_token_count
        parsed: dict[str, Any] = json.loads(response.text or "{}")
        return parsed

    async def stream_text(
        self, *, system: str, prompt: str, thinking_budget: int = 1024
    ) -> AsyncIterator[str]:
        from google.genai import types

        stream = await self._client.aio.models.generate_content_stream(
            model=self._model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
            ),
        )
        async for chunk in stream:
            if chunk.usage_metadata is not None:
                self.last_usage_tokens = chunk.usage_metadata.total_token_count
            if chunk.text:
                yield chunk.text


def _fill_schema_defaults(schema: dict[str, Any]) -> dict[str, Any]:
    """A minimal, deterministic value for every required property in a
    JSON Schema object — good enough for tests that only care that the
    pipeline *calls* the model and handles a well-shaped response, not
    what the response says. See `auto_fill_schema=True`."""
    properties = schema.get("properties", {})
    result: dict[str, Any] = {}
    for name in schema.get("required", properties.keys()):
        prop = properties.get(name, {})
        result[name] = _fill_type_default(prop)
    return result


def _fill_type_default(prop: dict[str, Any]) -> Any:
    prop_type = prop.get("type")
    if prop_type == "string":
        enum = prop.get("enum")
        return enum[0] if enum else "fake"
    if prop_type == "number":
        return 0.5
    if prop_type == "integer":
        return 0
    if prop_type == "array":
        return []
    if prop_type == "object":
        return _fill_schema_defaults(prop)
    return None


class FakeLLMClient:
    """Test double: canned JSON responses queued per call, and a canned
    text stream split into chunks. Records every call for assertions
    (e.g. "the retry actually happened", "the prompt never contained the
    raw trace")."""

    def __init__(
        self,
        *,
        json_responses: list[dict[str, Any]] | None = None,
        text_response: str = "",
        stream_chunk_size: int = 12,
        auto_fill_schema: bool = False,
    ) -> None:
        self._json_responses = list(json_responses or [])
        self._text_response = text_response
        self._stream_chunk_size = stream_chunk_size
        self._auto_fill_schema = auto_fill_schema
        self.calls: list[dict[str, Any]] = []
        self.last_usage_tokens: int | None = 42

    async def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        response_schema: dict[str, Any],
        thinking_budget: int = 0,
    ) -> dict[str, Any]:
        self.calls.append(
            {"kind": "json", "system": system, "prompt": prompt, "thinking_budget": thinking_budget}
        )
        if self._json_responses:
            return self._json_responses.pop(0)
        if self._auto_fill_schema:
            return _fill_schema_defaults(response_schema)
        raise AssertionError("FakeLLMClient.generate_json called with no queued responses left")

    async def stream_text(
        self, *, system: str, prompt: str, thinking_budget: int = 1024
    ) -> AsyncIterator[str]:
        self.calls.append(
            {
                "kind": "stream",
                "system": system,
                "prompt": prompt,
                "thinking_budget": thinking_budget,
            }
        )
        text = self._text_response
        size = self._stream_chunk_size
        for i in range(0, len(text), size):
            yield text[i : i + size]
