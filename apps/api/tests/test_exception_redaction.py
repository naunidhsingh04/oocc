"""docs/PRD.md §4.5: the provider key must never reach an error response or
a logged traceback, even when it ends up embedded in an exception's own
message (e.g. a downstream HTTP client error that echoes a request URL or
header). This is the counterpart to test_logging_redaction.py's happy-path
check, exercising the exception_handler in app/main.py instead of a normal
response.
"""

import io

from app.logging import configure_logging
from app.main import app
from fastapi.testclient import TestClient

SENTINEL = "sk-sentinel-do-not-log-this-9f3a7c21"


@app.get("/__test_raises")
async def _raises_with_sentinel_in_message() -> None:
    # Simulates an exception whose own text happens to contain the secret
    # (e.g. an httpx error repr-ing the failed request) — the worst case
    # for a naive "just log str(exc)" handler.
    raise RuntimeError(f"upstream call failed for key {SENTINEL}")


def test_unhandled_exception_does_not_leak_the_key_in_the_response() -> None:
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/__test_raises", headers={"X-Provider-Key": SENTINEL})

    assert response.status_code == 500
    assert SENTINEL not in response.text
    assert response.json() == {"error": "internal_error"}


def test_unhandled_exception_does_not_leak_the_key_in_logs() -> None:
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        client = TestClient(app, raise_server_exceptions=False)
        client.get("/__test_raises", headers={"X-Provider-Key": SENTINEL})

        logged_text = log_stream.getvalue()
        assert logged_text
        assert SENTINEL not in logged_text
        assert "[redacted]" in logged_text
    finally:
        configure_logging()
