"""POST /api/runs — runs a program through the executor and the full
LangGraph pipeline (docs/PRD.md §4.2): digest, the deterministic analyzers,
algorithm_classifier, viz_planner, and narrator. `app/agents/graph.py` is
the only place these nodes are wired together — this router just supplies
the executor and an optional LLM client and returns the graph's result.

With no `X-Provider-Key`, every deterministic output (trace, structures,
insights, complexity, plan) is still produced in full; only
`algorithm`/`narration` (both LLM-only, no deterministic core) come back
empty. `capabilities` tells the frontend which is which up front, so it can
render the tutor/narration UI as a quiet affordance rather than probing
with a request that's going to degrade (PRD §4.5).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from oocc_contracts import validate_analysis
from pydantic import BaseModel

from app.agents.graph import run_pipeline_cached
from app.agents.llm_client import GeminiClient, LLMClient
from app.cache import Cache
from app.executor_client import ExecutorClient
from app.redis_client import get_cache
from app.security import ProviderKey, get_provider_key

router = APIRouter()


class RunRequest(BaseModel):
    source: str
    stdin: str = ""


def get_executor_client() -> ExecutorClient:
    return ExecutorClient()


def get_llm_client(provider_key: ProviderKey = Depends(get_provider_key)) -> LLMClient | None:
    if not provider_key.is_present:
        return None
    return GeminiClient(provider_key.reveal())


@router.post("/api/runs")
async def create_run(
    request: RunRequest,
    executor: ExecutorClient = Depends(get_executor_client),
    llm_client: LLMClient | None = Depends(get_llm_client),
    cache: Cache = Depends(get_cache),
) -> dict[str, Any]:
    result = await run_pipeline_cached(
        source=request.source,
        stdin=request.stdin,
        executor=executor,
        llm_client=llm_client,
        cache=cache,
    )
    trace = result["trace"]

    analysis = {
        "structures": result["structures"],
        "insights": result["insights"],
        "complexity": result["complexity"],
    }
    validate_analysis(analysis)

    return {
        "trace": trace,
        "analysis": analysis,
        "plan": result["plan"],
        "algorithm": result["algorithm"],
        "narration": {
            "insights": result["insight_narrations"],
            "complexity": result["complexity_narration"],
            "plan_summary": result["plan_summary"],
            "step_ranges": result["narration"],
        },
        "capabilities": {"tutor": llm_client is not None, "narration": llm_client is not None},
    }
