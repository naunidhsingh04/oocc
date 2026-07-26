"""services/executor — the real tracer, behind an HTTP boundary.

docs/PRD.md §2.2 / §5: the executor is a separate service from day one —
never in the API process, never in the API container — because it is the
one place untrusted user code runs. apps/api calls this service over HTTP;
it never imports app.tracer in-process. gVisor/nsjail, resource limits, and
the adversarial test suite are deployment-time hardening on top of this
same boundary and remain unbuilt — nothing here should be mistaken for that.
"""

from __future__ import annotations

from fastapi import FastAPI
from oocc_contracts import validate_trace
from pydantic import BaseModel

from executor_app.tracer import CounterTracer, Tracer

app = FastAPI(title="OOCC Executor")


class ExecuteRequest(BaseModel):
    source: str
    stdin: str = ""


class CounterResult(BaseModel):
    status: str
    step_count: int
    duration_ms: float


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/execute")
async def execute(request: ExecuteRequest) -> dict:
    """Full trace, schema-validated before it ever leaves the executor."""
    trace = Tracer().run(request.source, stdin=request.stdin)
    validate_trace(trace)  # raises -> 500 rather than shipping a malformed trace
    return trace


@app.post("/execute/counters")
async def execute_counters(request: ExecuteRequest) -> CounterResult:
    """Fast, snapshot-free step count — complexity_analyst's only use of the
    executor. No frame/heap capture, so it tolerates far larger inputs than
    /execute in the same wall-clock budget."""
    result = CounterTracer().run(request.source, stdin=request.stdin)
    return CounterResult(**result)
