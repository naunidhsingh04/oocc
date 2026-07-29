"""services/executor — the real tracer, behind an HTTP boundary.

docs/PRD.md §2.2 / §5: the executor is a separate service from day one —
never in the API process, never in the API container — because it is the
one place untrusted user code runs. apps/api calls this service over HTTP;
it never imports app.tracer in-process. gVisor/nsjail, resource limits, and
the adversarial test suite are deployment-time hardening on top of this
same boundary and remain unbuilt — nothing here should be mistaken for that.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from oocc_contracts import validate_trace
from pydantic import BaseModel, Field

from executor_app.tracer import CounterTracer, Tracer

app = FastAPI(title="OOCC Executor")

# docs/PRD.md §3.3: "5s (10s for authed users)" — the caller (apps/api,
# which knows the request's auth state) picks a value in this range and
# passes it explicitly; this is just the server-side sanity clamp so a
# client can never request an unbounded (or zero) wall-clock budget.
# Never trust a client-supplied timeout without a ceiling.
MIN_WALL_CLOCK_LIMIT_S = 0.1
MAX_WALL_CLOCK_LIMIT_S = 30.0


class ExecuteRequest(BaseModel):
    source: str
    stdin: str = ""
    wall_clock_limit_s: float | None = Field(default=None, gt=0)


class CounterResult(BaseModel):
    status: str
    step_count: int
    duration_ms: float


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/execute")
async def execute(request: ExecuteRequest) -> dict[str, Any]:
    """Full trace, schema-validated before it ever leaves the executor."""
    if request.wall_clock_limit_s is None:
        tracer = Tracer()
    else:
        clamped = min(
            max(request.wall_clock_limit_s, MIN_WALL_CLOCK_LIMIT_S), MAX_WALL_CLOCK_LIMIT_S
        )
        tracer = Tracer(wall_clock_limit_s=clamped)
    trace = tracer.run(request.source, stdin=request.stdin)
    validate_trace(trace)  # raises -> 500 rather than shipping a malformed trace
    return trace


@app.post("/execute/counters")
async def execute_counters(request: ExecuteRequest) -> CounterResult:
    """Fast, snapshot-free step count — complexity_analyst's only use of the
    executor. No frame/heap capture, so it tolerates far larger inputs than
    /execute in the same wall-clock budget."""
    result = CounterTracer().run(request.source, stdin=request.stdin)
    return CounterResult(**result)
