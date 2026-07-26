"""OOCC API — FastAPI app shell. docs/PRD.md §2.

Phase 0 ships only /health, CORS, and structured logging with provider-key
redaction. Everything else (runs, problems, progress, agent orchestration)
lands in later phases.
"""

from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.logging import bind_sensitive_value, configure_logging

configure_logging()
logger = structlog.get_logger("oocc.api")

app = FastAPI(title="OOCC API")

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
    # on, in this request only, has the key scrubbed if it appears.
    bind_sensitive_value(request.headers.get("x-provider-key"))
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
