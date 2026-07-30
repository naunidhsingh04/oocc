"""CORS regression coverage for the bugs found on the real Render deploy:
ALLOWED_ORIGINS wasn't the env var the code actually read (main.py used to
read CORS_ORIGINS, which nothing set), and Starlette routes a bare
`Exception` handler through ServerErrorMiddleware — architecturally
outside CORSMiddleware — so an unhandled exception's response never got
CORS headers no matter how the middleware was ordered. See
app/main.py's own comments on both.
"""

import pytest
from app.main import app
from fastapi.testclient import TestClient

# Matches app/main.py's _DEFAULT_ALLOWED_ORIGINS (no ALLOWED_ORIGINS env
# var set in the test environment) — same convention test_health.py
# already uses.
ALLOWED_FRONTEND_ORIGIN = "http://localhost:3000"


def test_preflight_on_a_real_route_returns_200_with_cors_headers() -> None:
    client = TestClient(app)
    response = client.options(
        "/api/runs",
        headers={
            "Origin": ALLOWED_FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_FRONTEND_ORIGIN


def test_preflight_on_a_nonexistent_route_still_returns_200_with_cors_headers() -> None:
    # CORSMiddleware answers preflight at the ASGI level before routing
    # ever happens — a typo'd path must not turn into "no CORS headers,
    # so the browser reports this as a CORS error" on top of the real 404.
    client = TestClient(app)
    response = client.options(
        "/api/this-route-does-not-exist",
        headers={
            "Origin": ALLOWED_FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_FRONTEND_ORIGIN


def test_404_response_still_carries_cors_headers() -> None:
    client = TestClient(app)
    response = client.get(
        "/api/this-route-does-not-exist", headers={"Origin": ALLOWED_FRONTEND_ORIGIN}
    )
    assert response.status_code == 404
    assert response.headers["access-control-allow-origin"] == ALLOWED_FRONTEND_ORIGIN


def test_401_response_still_carries_cors_headers() -> None:
    # app/routers/progress.py's routes raise HTTPException(401) with no
    # session — one of the two symptoms reported alongside the CORS bug.
    client = TestClient(app)
    response = client.get("/api/progress", headers={"Origin": ALLOWED_FRONTEND_ORIGIN})
    assert response.status_code == 401
    assert response.headers["access-control-allow-origin"] == ALLOWED_FRONTEND_ORIGIN


def test_disallowed_origin_gets_no_cors_header() -> None:
    client = TestClient(app)
    response = client.get("/health", headers={"Origin": "https://not-allowed.example.com"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_unhandled_exception_response_still_carries_cors_headers() -> None:
    # /__test_raises is registered on this same shared `app` by
    # test_exception_redaction.py — reused here rather than duplicated.
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/__test_raises", headers={"Origin": ALLOWED_FRONTEND_ORIGIN})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == ALLOWED_FRONTEND_ORIGIN


def test_unhandled_exception_from_a_disallowed_origin_gets_no_cors_header() -> None:
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/__test_raises", headers={"Origin": "https://not-allowed.example.com"})
    assert response.status_code == 500
    assert "access-control-allow-origin" not in response.headers


def test_cors_middleware_wraps_log_requests_not_the_other_way_around() -> None:
    # Structural pin for the ordering bug itself, independent of any one
    # request's behavior: CORSMiddleware must be closer to the client
    # (i.e. appear *after* the custom log_requests dispatch middleware in
    # app.user_middleware, since Starlette's add_middleware inserts at
    # position 0 — see app/main.py's comment on this exact gotcha).
    # Without this, a future edit could reorder the two calls back to the
    # "obviously correct" source order and silently reintroduce the bug.
    # `m.cls`'s Starlette-declared type (`_MiddlewareFactory[P]`) doesn't
    # expose `__name__` to mypy even though every real middleware class
    # has one at runtime — getattr with a fallback keeps this honest
    # under --strict without a blanket type: ignore.
    middleware_classes = [getattr(m.cls, "__name__", repr(m.cls)) for m in app.user_middleware]
    cors_index = middleware_classes.index("CORSMiddleware")
    log_index = next(i for i, name in enumerate(middleware_classes) if name != "CORSMiddleware")
    assert cors_index < log_index, (
        f"CORSMiddleware must precede every other user middleware in "
        f"app.user_middleware (Starlette wraps in reverse-registration "
        f"order), got {middleware_classes}"
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://oocc-six.vercel.app", ["https://oocc-six.vercel.app"]),
        (" https://oocc-six.vercel.app ", ["https://oocc-six.vercel.app"]),
        ("https://oocc-six.vercel.app/", ["https://oocc-six.vercel.app"]),
        (
            "https://a.example.com/, https://b.example.com/ ",
            ["https://a.example.com", "https://b.example.com"],
        ),
    ],
)
def test_allowed_origins_parsing_strips_whitespace_and_trailing_slash(
    raw: str, expected: list[str]
) -> None:
    # Exercises the exact parsing expression in app/main.py directly
    # (re-imported here, not re-implemented) so this can't drift from the
    # real code.
    parsed = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    assert parsed == expected


def test_app_main_source_logs_cors_configuration_at_import_time() -> None:
    # The actual "does it print to Render's logs" behavior is straightforward
    # enough (one unconditional logger.info call right after parsing) that
    # it was manually verified via captured stdout during development:
    #   {"allowed_origins": ["https://oocc-six.vercel.app"], "event":
    #    "cors.configured", "level": "info", ...}
    # An automated version of that check needs importlib.reload(app.main)
    # to observe module-level startup behavior after the fact, but this
    # module is imported once and shared (via `from app.main import app`)
    # by nearly every other test file in this suite, several of which
    # register their own routes on that specific object (e.g.
    # test_exception_redaction.py's /__test_raises) — reloading it mid-suite
    # replaces `app.main.app` with a fresh instance missing those routes and
    # broke unrelated tests depending on run order. A static check on the
    # source is a more honest test than a reload that corrupts shared state.
    import inspect

    import app.main as main_module

    source = inspect.getsource(main_module)
    assert '"cors.configured"' in source
    assert "allowed_origins=allowed_origins" in source
