"""POST /api/tutor — the only streaming node (docs/PRD.md §4.2, §4.3 item
4). SSE, not raw text streamed token-by-token from the model: the retry
rule ("a response with zero step_refs is retried once before it ships")
means we cannot commit to what the client sees until validation has
already passed, so `app/tutor/tutor.answer_question` runs one (possibly
two) non-streaming structured calls first, and only once a validated
`{answer, step_refs}` exists does this endpoint chunk it out over SSE.
The wire protocol is still genuinely SSE — `text/event-stream`, multiple
`data:` events — the model call underneath it just isn't.

With no `X-Provider-Key`, the tutor is not a hard error: it emits a single
`unavailable` event so the frontend can render the same affordance PRD
§4.5 asks for (a quiet "add a key" prompt, not a paywall wall) without a
different code path for "no key" vs "the model failed".
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.digest import compute_digest
from app.agents.llm_client import GeminiClient, LLMClient
from app.rag.concept_store import ConceptStore, PostgresConceptStore
from app.rag.embeddings import Embedder, GeminiEmbedder
from app.rag.retrieval import retrieve_top_k
from app.security import ProviderKey, get_provider_key
from app.tutor.context import TutorTurn
from app.tutor.tutor import answer_question

router = APIRouter()
logger = structlog.get_logger("oocc.api")

_pg_pool: Any | None = None


class TutorRequest(BaseModel):
    trace: dict[str, Any]
    source: str
    current_step: int
    question: str
    history: list[TutorTurn] = []


class _LazyPostgresConceptStore:
    """FastAPI resolves every declared dependency before the route body
    runs, even the no-key branch that never touches it — so this can't
    connect to Postgres at __init__ time, only the first time a method on
    it is actually awaited. Constructing this is itself synchronous and
    connects nothing."""

    async def _store(self) -> ConceptStore:
        global _pg_pool
        if _pg_pool is None:
            from app.rag.db import create_pool

            _pg_pool = await create_pool()
        return PostgresConceptStore(_pg_pool)

    async def add_chunk(self, **kwargs: Any) -> None:
        store = await self._store()
        await store.add_chunk(**kwargs)

    async def search(self, **kwargs: Any) -> Any:
        store = await self._store()
        return await store.search(**kwargs)


def get_concept_store() -> ConceptStore:
    return _LazyPostgresConceptStore()


def get_llm_client_for_tutor(
    provider_key: ProviderKey = Depends(get_provider_key),
) -> LLMClient | None:
    if not provider_key.is_present:
        return None
    return GeminiClient(provider_key.reveal())


def get_embedder_for_tutor(
    provider_key: ProviderKey = Depends(get_provider_key),
) -> Embedder | None:
    if not provider_key.is_present:
        return None
    return GeminiEmbedder(provider_key.reveal())


def _sse(event_type: str, data: dict[str, Any]) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


@router.post("/api/tutor")
async def tutor_endpoint(
    request: TutorRequest,
    llm_client: LLMClient | None = Depends(get_llm_client_for_tutor),
    embedder: Embedder | None = Depends(get_embedder_for_tutor),
    concept_store: ConceptStore = Depends(get_concept_store),
) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[str]:
        if llm_client is None or embedder is None:
            yield _sse("unavailable", {"reason": "no_provider_key"})
            return

        digest = compute_digest(request.trace)
        try:
            curriculum_chunks = await retrieve_top_k(
                query=request.question, store=concept_store, embedder=embedder
            )
        except Exception as exc:  # noqa: BLE001 — RAG is additive context, not a hard dependency
            logger.warning("tutor.retrieval_failed", error=str(exc))
            curriculum_chunks = []
        result = await answer_question(
            digest=digest,
            trace=request.trace,
            current_step=request.current_step,
            curriculum_chunks=curriculum_chunks,
            history=request.history,
            question=request.question,
            llm_client=llm_client,
        )

        chunk_size = 40
        for i in range(0, len(result.answer), chunk_size):
            yield _sse("chunk", {"text": result.answer[i : i + chunk_size]})
        yield _sse(
            "done",
            {
                "step_refs": result.step_refs,
                "degraded": result.degraded,
                "tokens_used": llm_client.last_usage_tokens,
            },
        )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
