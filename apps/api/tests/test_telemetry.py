"""app/telemetry.py — Phase 6 operations ("OpenTelemetry across the API and
every agent graph node"). `configure_telemetry`'s `TracerProvider` is
process-global and set-once (OTel's own rule — a second `set_tracer_provider`
call is a silent no-op with a warning), and `conftest.py` already imports
`app.main` before any test runs, which already configured it. So these
tests inspect the *active* span from inside `traced_node`'s wrapped
function rather than swapping in a fresh in-memory-exporter provider — the
thing worth actually verifying is "a real, correctly-named span is active
during the node's execution," which this catches: the regression this file
guards against (`TracerProvider(Resource.create(...))` passing the
resource as the wrong positional arg, discovered when this instrumentation
was first wired up and broke `test_health.py` with an `AttributeError`) is
a startup-time crash, not a span-shape bug — so "the app imports and spans
get created at all" is the meaningful thing to prove.
"""

from __future__ import annotations

import pytest
from app.telemetry import get_tracer, traced_node
from opentelemetry import trace

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_traced_node_produces_a_span_named_after_the_node() -> None:
    seen_span_names: list[str] = []

    @traced_node("digest")
    async def fake_node(state: dict) -> dict:
        seen_span_names.append(trace.get_current_span().name)  # type: ignore[attr-defined]
        return {"ok": True}

    result = await fake_node({})

    assert result == {"ok": True}
    assert seen_span_names == ["agent.digest"]


async def test_traced_node_still_propagates_exceptions() -> None:
    @traced_node("insight_scanner")
    async def failing_node(state: dict) -> dict:
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        await failing_node({})


async def test_get_tracer_returns_a_real_tracer() -> None:
    tracer = get_tracer("oocc.test")
    with tracer.start_as_current_span("smoke"):
        pass
