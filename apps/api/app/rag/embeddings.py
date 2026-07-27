"""Text embeddings for the tutor's curriculum RAG (docs/PRD.md §4.3, §8's
`concept_chunks.embedding vector(768)`). Same request-scoped-key story as
`app/agents/llm_client.py`: `GeminiEmbedder` is constructed fresh from the
user's own key, never cached, never shared across requests.
"""

from __future__ import annotations

import hashlib
import struct
from typing import Protocol

EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIM = 768


class Embedder(Protocol):
    async def embed(self, text: str) -> list[float]: ...


class GeminiEmbedder:
    def __init__(self, api_key: str, *, model: str = EMBEDDING_MODEL) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def embed(self, text: str) -> list[float]:
        response = await self._client.aio.models.embed_content(model=self._model, contents=text)
        embeddings = response.embeddings
        if not embeddings or embeddings[0].values is None:
            raise RuntimeError("embed_content returned no embedding")
        return list(embeddings[0].values)


class FakeEmbedder:
    """Deterministic, offline stand-in: a hash-derived unit vector, stable
    per exact input text. Good for testing retrieval *mechanics* (top-k
    ordering, exact-match similarity == 1.0) without network access or a
    real model — it has no notion of semantic similarity between different
    wordings, so it can't stand in for embedding-quality assertions."""

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self._dim = dim

    async def embed(self, text: str) -> list[float]:
        values: list[float] = []
        counter = 0
        while len(values) < self._dim:
            digest = hashlib.sha256(text.encode() + counter.to_bytes(4, "big")).digest()
            for offset in range(0, len(digest) - 3, 4):
                if len(values) >= self._dim:
                    break
                (raw,) = struct.unpack(">I", digest[offset : offset + 4])
                values.append(raw / 2**32 - 0.5)
            counter += 1
        norm = sum(v * v for v in values) ** 0.5
        return [v / norm for v in values] if norm else values
