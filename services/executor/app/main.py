"""services/executor — Phase 0 placeholder.

docs/PRD.md §2.2 / §5: the executor is a separate service from day one —
never in the API process, never in the API container — because it is the
one place untrusted user code runs. This container boundary exists now so
Phase 1 has somewhere to put the real thing: sys.monitoring tracer, gVisor/
nsjail sandbox, resource limits, the adversarial test suite. Nothing in this
file executes user code.
"""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="OOCC Executor")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
