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
from app.env_checks import check_production_config
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

# Render's env var for this is ALLOWED_ORIGINS (see DEPLOY.md) — this used
# to read CORS_ORIGINS, which nothing ever set in the real deployment, so
# every request silently fell back to the http://localhost:3000 default
# and the browser rejected every cross-origin call from the real frontend
# as a CORS failure. Also strips a trailing slash on top of whitespace —
# "https://oocc-six.vercel.app/" (note the slash) never equals the
# Origin header's own "https://oocc-six.vercel.app", and that mismatch is
# silent: CORSMiddleware just treats the origin as not-allowed, no error
# anywhere.
_DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000"
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]

# Printed at startup (not just available via /health or a debug endpoint)
# specifically so a misconfigured/misspelled/missing env var shows up in
# the platform's own deploy logs immediately, instead of only surfacing
# indirectly as "the frontend is broken" with no pointer to why.
logger.info("cors.configured", allowed_origins=allowed_origins)

# Raises (refusing to start) if ENVIRONMENT=production and either
# SESSION_SECRET or ALLOWED_ORIGINS is still at an insecure/missing
# default — see app/env_checks.py. No-op in dev/tests (ENVIRONMENT unset).
check_production_config(allowed_origins=allowed_origins)


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


# log_requests registered *before* CORSMiddleware, not after, even though
# it reads as backwards next to "CORS must wrap everything" — Starlette's
# own `add_middleware` inserts each call at the *front* of the middleware
# list (see starlette.applications.Starlette.add_middleware), so whichever
# call happens *last* ends up outermost, wrapping everything registered
# before it. Registering CORS first (the previous, source-order-intuitive
# but wrong order — caught by this file's own test suite) put log_requests
# outside CORS instead: any exception raised inside log_requests itself —
# before it ever reaches CORSMiddleware — propagated straight to
# Starlette's ServerErrorMiddleware with no CORS headers ever attached,
# which a browser reports as an opaque CORS failure, not the real error.
# `test_cors.py::test_cors_middleware_wraps_log_requests_not_the_other_way_around`
# pins this ordering so it can't silently regress.
app.middleware("http")(log_requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers_for_origin(request: Request) -> dict[str, str]:
    """Starlette dispatches a handler registered for the bare `Exception`
    type through `ServerErrorMiddleware` — architecturally the *outermost*
    layer, wrapping even CORSMiddleware (see
    `starlette.applications.Starlette.build_middleware_stack`: it pulls
    any `Exception`/500 handler out of the normal middleware stack
    entirely). A response built here never passes back through
    CORSMiddleware, so it never gets CORS headers by any ordering fix —
    the only way to get them onto a genuinely unhandled exception's
    response is to attach them by hand, right here, using the same
    allow-list this app's CORSMiddleware was configured with.
    """
    origin = request.headers.get("origin")
    if origin is None or origin not in allowed_origins:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # docs/PRD.md §4.5: never include the provider key in an error
    # response, including via a leaked traceback. `logger.exception` goes
    # through the same redaction pipeline as every other log call (see
    # app/logging.py's format_exc_info -> redact ordering); the response
    # body never contains exception internals at all, generic message
    # only, so there's no second surface to scrub.
    logger.exception("request.unhandled_exception", path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error"},
        headers=_cors_headers_for_origin(request),
    )


app.include_router(runs_router)
app.include_router(tutor_router)
app.include_router(settings_router)
app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(progress_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
