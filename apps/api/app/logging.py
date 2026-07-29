"""structlog configuration, plus request-scoped secret redaction.

docs/PRD.md §4.5: a user's provider key is request-scoped only and must
never be logged. `bind_sensitive_value` registers a secret (this request's
X-Provider-Key) to be scrubbed from every log record for the rest of the
request — wherever it ends up, not just under one specific field name. This
is deliberately more robust than filtering by header/field name: it catches
the key even if it's accidentally swept into a log call somewhere else
(e.g. a handler that logs the full headers dict, or an error message).

contextvars give this per-request isolation for free: each request is
handled in its own asyncio Task, and a Task's context is a copy taken at
creation time, so one request's `bind_sensitive_value` call can never leak
into a concurrently- or later-handled request.
"""

from __future__ import annotations

import contextvars
import sys
from typing import Any, TextIO

import structlog
from structlog.typing import EventDict, WrappedLogger

REDACTED = "[redacted]"

_current_secrets: contextvars.ContextVar[frozenset[str]] = contextvars.ContextVar(
    "oocc_current_secrets", default=frozenset()
)


def bind_sensitive_value(value: str | None) -> None:
    if not value:
        return
    _current_secrets.set(_current_secrets.get() | {value})


def scrub_secrets(text: str) -> str:
    """Public entry point for scrubbing a plain string outside the
    structlog pipeline — e.g. an exception handler formatting a traceback
    for a response or an external error report. Uses the same
    request-scoped secret set `bind_sensitive_value` populates."""
    # `_scrub` is deliberately `Any -> Any` (it recurses over dict/list/str
    # values from a structlog event dict) — its own `isinstance(value, str)`
    # branch guarantees a `str` input always returns a `str`, so this
    # narrows the type back rather than widening what `_scrub` accepts.
    scrubbed: str = _scrub(text)
    return scrubbed


def _scrub(value: Any) -> Any:
    secrets = _current_secrets.get()
    if isinstance(value, str):
        for secret in secrets:
            value = value.replace(secret, REDACTED)
        return value
    if isinstance(value, dict):
        return {key: _scrub(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_scrub(item) for item in value]
    return value


def _redact_secrets_processor(
    _logger: WrappedLogger, _method_name: str, event_dict: EventDict
) -> EventDict:
    if not _current_secrets.get():
        return event_dict
    return {key: _scrub(value) for key, value in event_dict.items()}


def configure_logging(*, output: TextIO | None = None) -> None:
    """(Re)configure structlog. `output` is exposed for tests that need to
    inspect the fully rendered log stream (see tests/test_logging_redaction.py)."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            # Must run before the redaction processor: exc_info starts as a
            # live exception object, not text, so a secret embedded in an
            # exception's message would otherwise reach JSONRenderer
            # unscrubbed. format_exc_info turns it into a formatted string
            # first so `_redact_secrets_processor` can actually see it.
            structlog.processors.format_exc_info,
            _redact_secrets_processor,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.PrintLoggerFactory(file=output or sys.stdout),
        cache_logger_on_first_use=False,
    )
