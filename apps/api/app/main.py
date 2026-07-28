"""OOCC API — FastAPI app shell. docs/PRD.md §2.

Phase 0 shipped /health, CORS, and structured logging with provider-key
redaction. Phase 2 adds POST /api/runs (app/routers/runs.py) — the
deterministic analysis pipeline. Problems, progress, and LLM agent
orchestration land in later phases.
"""

from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.auth.tokens import SESSION_COOKIE_NAME
from app.logging import bind_sensitive_value, configure_logging
from app.routers.auth import router as auth_router
from app.routers.problems import router as problems_router
from app.routers.progress import router as progress_router
from app.routers.runs import router as runs_router
from app.routers.settings import router as settings_router
from app.routers.tutor import router as tutor_router
from app.telemetry import configure_telemetry

configure_logging()
configure_telemetry()
logger = structlog.get_logger("oocc.api")

app = FastAPI(title="OOCC API")

# Auto-instruments every route with a span (method, path, status code) —
# additive only; see app/telemetry.py's docstring for why this never
# becomes a hard dependency on a reachable collector.
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # noqa: E402

FastAPIInstrumentor.instrument_app(app)

_DEFAULT_CORS_ORIGINS = "http://localhost:3000"
cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", _DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next: RequestResponseEndpoint) -> Response:
    # Bind before logging anything for this request: everything from here
    # on, in this request only, has the key scrubbed if it appears. The
    # session cookie is bound here too (not just in
    # app.routers.auth.get_current_user_optional), because this middleware
    # logs the full request headers below, before any route dependency
    # gets a chance to run — binding inside the dependency alone would be
    # too late to protect that very log line.
    bind_sensitive_value(request.headers.get("x-provider-key"))
    bind_sensitive_value(request.cookies.get(SESSION_COOKIE_NAME))
    logger.info(
        "request.received",
        method=request.method,
        path=request.url.path,
        headers=dict(request.headers),
    )
    response = await call_next(request)
    logger.info(
        "request.completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # docs/PRD.md §4.5: never include the provider key in an error
    # response, including via a leaked traceback. `logger.exception` goes
    # through the same redaction pipeline as every other log call (see
    # app/logging.py's format_exc_info -> redact ordering); the response
    # body never contains exception internals at all, generic message
    # only, so there's no second surface to scrub.
    logger.exception("request.unhandled_exception", path=request.url.path)
    return JSONResponse(status_code=500, content={"error": "internal_error"})


app.include_router(runs_router)
app.include_router(tutor_router)
app.include_router(settings_router)
app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(progress_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
