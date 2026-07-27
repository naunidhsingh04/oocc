"""InMemoryTraceStore round-trip (app/storage/trace_store.py). No S3/R2
endpoint is reachable from this environment, so `S3TraceStore` is
exercised only by real deployment — the same status as
`app.rag.concept_store.PostgresConceptStore` — and every test here runs
against the `TraceStore` protocol via the in-memory fake."""

from __future__ import annotations

import gzip
import json

import pytest
from app.storage.trace_store import InMemoryTraceStore

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def test_put_then_get_round_trips_the_trace() -> None:
    store = InMemoryTraceStore()
    trace = {"schema_version": "1.0", "steps": [{"i": 0, "event": "line"}]}

    url = await store.put(trace)
    result = await store.get(url)

    assert result == trace


async def test_put_returns_a_distinct_url_each_time() -> None:
    store = InMemoryTraceStore()
    trace = {"steps": []}

    url_one = await store.put(trace)
    url_two = await store.put(trace)

    assert url_one != url_two
    assert len(store) == 2


async def test_stored_payload_is_actually_gzipped() -> None:
    store = InMemoryTraceStore()
    trace = {"steps": [{"i": i} for i in range(100)]}
    url = await store.put(trace)

    key = url.removeprefix("mem://")
    raw = store._objects[key]  # noqa: SLF001 — whitebox check that gzip really happened
    assert gzip.decompress(raw) == json.dumps(trace).encode()
