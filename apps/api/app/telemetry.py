"""OpenTelemetry wiring (Phase 6 operations: "OpenTelemetry across the API
and every agent graph node"). Exports over OTLP/HTTP to whatever collector
`OTEL_EXPORTER_OTLP_ENDPOINT` points at (Honeycomb, Grafana Cloud, a
self-hosted collector — anything OTLP-compatible; no vendor SDK). With no
endpoint configured, spans are created and immediately dropped (a
`ConsoleSpanExporter` in dev, nothing in prod) — tracing is additive
instrumentation, never a hard dependency the way the deterministic
pipeline itself is (same "must never break `POST /api/runs`" rule
`app/redis_client.py`'s lazy Redis wrappers already follow).

Two things get spans beyond FastAPI's own auto-instrumented HTTP layer
(`instrument_app`, called once from `app/main.py`):
1. Every LangGraph node in `app/agents/graph.py` (`digest`,
   `structure_detector`, `insight_scanner`, `complexity_analyst`,
   `algorithm_classifier`, `viz_planner`, `narrator`) — `traced_node` wraps
   each node function so a slow run shows *which* node was slow, not just
   that `/api/runs` was slow overall.
2. The executor call itself (`app/executor_client.py`) and the LLM call
   (`app/agents/llm_client.py`) — the two places PRD's own architecture
   diagram (§2) draws as separate services/APIs, and therefore the two
   places most likely to dominate a slow trace.
"""

from __future__ import annotations

import functools
import os
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

_F = TypeVar("_F", bound=Callable[..., Awaitable[Any]])

_configured = False


def configure_telemetry(*, service_name: str = "oocc-api") -> None:
    """Idempotent — safe to call from both `app/main.py`'s module-level
    setup and from a test's own fixture without double-registering
    exporters. Endpoint/headers come from the standard OTEL_EXPORTER_OTLP_*
    env vars (OTel's own convention, not an OOCC-specific one) so this
    works unmodified against any OTLP-compatible backend.
    """
    global _configured
    if _configured:
        return
    _configured = True

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    elif os.environ.get("OTEL_CONSOLE_EXPORT") == "1":
        # Opt-in only — a console exporter on every request is noisy for
        # normal local dev; set OTEL_CONSOLE_EXPORT=1 to actually see spans
        # without standing up a collector.
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)


def get_tracer(name: str) -> trace.Tracer:
    return trace.get_tracer(name)


def traced_node(node_name: str) -> Callable[[_F], _F]:
    """Wraps one `app/agents/graph.py` node coroutine in its own span,
    named `agent.<node_name>` — so a slow `/api/runs` shows which of the
    four parallel deterministic analyzers (or the LLM-only ones) actually
    took the time, instead of one opaque span for the whole graph.
    """

    def decorator(fn: _F) -> _F:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            tracer = get_tracer("oocc.agents")
            with tracer.start_as_current_span(f"agent.{node_name}"):
                return await fn(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
