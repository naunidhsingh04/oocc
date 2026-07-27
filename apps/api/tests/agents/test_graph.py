"""End-to-end pipeline tests (docs/PRD.md §4.2) against real fixtures and
the real executor (ASGI transport, no mocks — see conftest.py). The LLM is
always a FakeLLMClient: no network egress to Google in tests, ever."""

import json
from pathlib import Path

import pytest
from app.agents.graph import run_pipeline, run_pipeline_cached
from app.agents.llm_client import FakeLLMClient
from app.cache import InMemoryCache
from app.executor_client import ExecutorClient

pytestmark = pytest.mark.anyio

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"
PROGRAMS_DIR = FIXTURES_DIR / "generator" / "programs"


def _source(name: str) -> str:
    return (PROGRAMS_DIR / f"{name}.py").read_text()


def _trace(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


async def test_pipeline_with_no_key_still_produces_every_deterministic_output(
    executor_client: ExecutorClient,
) -> None:
    trace = _trace("binary_search")

    result = await run_pipeline(
        trace=trace, source=_source("binary_search"), executor=executor_client, llm_client=None
    )

    assert result["digest"].step_count == len(trace["steps"])
    assert result["structures"]  # binary_search's array is still detected
    assert result["insights"] == []  # binary_search has no real findings
    assert result["complexity"] is not None
    assert result["complexity"]["best_fit"] == "log_n"
    assert result["plan"]["panels"]
    # LLM-only nodes degrade to empty/None with no key.
    assert result["algorithm"] is None
    assert result["narration"] == []


async def test_pipeline_with_a_fake_key_calls_the_model_and_stays_valid(
    executor_client: ExecutorClient,
) -> None:
    trace = _trace("two_sum")
    llm_client = FakeLLMClient(auto_fill_schema=True)

    result = await run_pipeline(
        trace=trace, source=_source("two_sum"), executor=executor_client, llm_client=llm_client
    )

    assert result["structures"]
    assert result["complexity"] is None  # two_sum's size parameter isn't confidently found
    assert result["plan"]["panels"]
    # The model was actually invoked for every LLM-touching node.
    assert len(llm_client.calls) >= 3
    # A degraded (empty/None) algorithm/narration is acceptable from an
    # auto-filled fake response, but it must never crash the pipeline.
    assert result["algorithm"] is None or isinstance(result["algorithm"], dict)


class _CountingExecutor:
    """Wraps a real ExecutorClient but fails the test if `.execute` is
    called more than once — the signal that run_pipeline_cached's cache
    hit path skipped re-running the program (docs/PRD.md §4.4)."""

    def __init__(self, inner: ExecutorClient) -> None:
        self._inner = inner
        self.execute_calls = 0

    async def execute(self, source: str, *, stdin: str = "") -> dict:
        self.execute_calls += 1
        return await self._inner.execute(source, stdin=stdin)

    async def execute_counters(self, source: str, *, stdin: str = "") -> dict:
        return await self._inner.execute_counters(source, stdin=stdin)


async def test_run_pipeline_cached_skips_the_executor_and_deterministic_nodes_on_a_hit(
    executor_client: ExecutorClient,
) -> None:
    executor = _CountingExecutor(executor_client)
    cache = InMemoryCache()
    source = _source("binary_search")

    stdin = "1 3 5 7 9 11 13 15 17 19\n13\n"
    first = await run_pipeline_cached(
        source=source, stdin=stdin, executor=executor, llm_client=None, cache=cache
    )
    assert executor.execute_calls == 1
    assert len(cache) == 1

    second = await run_pipeline_cached(
        source=source, stdin=stdin, executor=executor, llm_client=None, cache=cache
    )

    assert executor.execute_calls == 1  # not called again
    assert second["trace"] == first["trace"]
    assert second["structures"] == first["structures"]
    assert second["complexity"] == first["complexity"]
