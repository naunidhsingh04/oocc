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

from fastapi import APIRouter, Depends, HTTPException, Request
from oocc_contracts import validate_analysis
from pydantic import BaseModel

from app.agents.graph import run_pipeline_cached
from app.agents.llm_client import GeminiClient, LLMClient
from app.auth.user_store import User
from app.cache import Cache
from app.executor_client import ExecutorClient
from app.rate_limit import RUNS_PER_IP_PER_MINUTE, RUNS_PER_USER_PER_MINUTE, RateLimiter
from app.redis_client import get_cache, get_rate_limiter
from app.routers.auth import get_current_user_optional
from app.security import ProviderKey, get_provider_key
from app.storage.wire_codec import encode_keyframed

router = APIRouter()


def _client_ip(request: Request) -> str:
    # Trusts the framework's own resolution (Starlette reads a configured
    # proxy header when running behind one) rather than reading
    # `X-Forwarded-For` here directly — this file doesn't know whether this
    # deployment sits behind a proxy, and a naive header read is itself a
    # spoofing vector if it *doesn't*.
    return request.client.host if request.client else "unknown"


async def enforce_run_rate_limit(
    request: Request,
    user: User | None = Depends(get_current_user_optional),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> None:
    ip_result = await limiter.check(
        f"runs:ip:{_client_ip(request)}", limit=RUNS_PER_IP_PER_MINUTE, window_seconds=60
    )
    if not ip_result.allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many runs from this address — try again shortly.",
            headers={"Retry-After": str(ip_result.retry_after_seconds)},
        )

    if user is not None:
        user_result = await limiter.check(
            f"runs:user:{user.id}", limit=RUNS_PER_USER_PER_MINUTE, window_seconds=60
        )
        if not user_result.allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many runs from this account — try again shortly.",
                headers={"Retry-After": str(user_result.retry_after_seconds)},
            )


class RunRequest(BaseModel):
    source: str
    stdin: str = ""


def get_executor_client() -> ExecutorClient:
    return ExecutorClient()


def get_llm_client(provider_key: ProviderKey = Depends(get_provider_key)) -> LLMClient | None:
    if not provider_key.is_present:
        return None
    return GeminiClient(provider_key.reveal())


@router.post("/api/runs", dependencies=[Depends(enforce_run_rate_limit)])
async def create_run(
    request: RunRequest,
    executor: ExecutorClient = Depends(get_executor_client),
    llm_client: LLMClient | None = Depends(get_llm_client),
    cache: Cache = Depends(get_cache),
    user: User | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    # docs/PRD.md §3.3: "5s (10s for authed users)".
    wall_clock_limit_s = 10.0 if user is not None else 5.0
    result = await run_pipeline_cached(
        source=request.source,
        stdin=request.stdin,
        executor=executor,
        llm_client=llm_client,
        cache=cache,
        wall_clock_limit_s=wall_clock_limit_s,
    )
    # §3.4 (Phase 6): every deterministic analyzer above already ran against
    # the raw, full-heap-per-step trace (and that's what's cached — see
    # app/cache.py and app/storage/wire_codec.py's module docstring). Encode
    # to the keyframe+patch wire format only now, on the response body itself
    # — this is the one place the trace actually leaves the process today.
    trace = encode_keyframed(result["trace"])

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
