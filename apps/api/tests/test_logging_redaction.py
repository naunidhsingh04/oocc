"""docs/PRD.md §4.5: a user's provider key is never logged. This sends a
request carrying a sentinel value as X-Provider-Key and asserts the sentinel
appears in no log record — checking the fully rendered log stream, not just
that one named field is absent, so the test can't pass by accident if the
key leaks into some other field or message.
"""

import io

from app.logging import configure_logging
from app.main import app
from fastapi.testclient import TestClient


def test_provider_key_is_redacted_from_every_log_record() -> None:
    sentinel = "sk-sentinel-do-not-log-this-9f3a7c21"
    log_stream = io.StringIO()
    configure_logging(output=log_stream)
    try:
        client = TestClient(app)
        response = client.get("/health", headers={"X-Provider-Key": sentinel})
        assert response.status_code == 200

        logged_text = log_stream.getvalue()
        assert logged_text, "expected at least one log record to have been written"
        assert sentinel not in logged_text
        # The header really was captured and scrubbed, not just never logged.
        assert "[redacted]" in logged_text
    finally:
        configure_logging()  # restore default (stdout) config for other tests
