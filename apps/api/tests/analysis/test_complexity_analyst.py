"""The done-condition that matters most: binary_search classified as
log_n and bubble_sort as n_squared, both with R^2 > 0.98, measured against
the real fixture programs (not synthetic stand-ins) via the real executor
(ASGI transport, no mocks — see conftest.py)."""

from pathlib import Path

import pytest
from app.analysis.complexity_analyst import analyze_complexity
from app.executor_client import ExecutorClient

pytestmark = pytest.mark.anyio

PROGRAMS_DIR = Path(__file__).resolve().parents[4] / "fixtures" / "generator" / "programs"


def _r2_for(result: dict, model: str) -> float:
    return next(f["r_squared"] for f in result["fits"] if f["model"] == model)


async def test_binary_search_is_logarithmic(executor_client: ExecutorClient) -> None:
    source = (PROGRAMS_DIR / "binary_search.py").read_text()
    result = await analyze_complexity(source, executor_client)
    assert result is not None
    assert result["best_fit"] == "log_n"
    assert _r2_for(result, "log_n") > 0.98


async def test_bubble_sort_is_quadratic(executor_client: ExecutorClient) -> None:
    source = (PROGRAMS_DIR / "bubble_sort.py").read_text()
    result = await analyze_complexity(source, executor_client)
    assert result is not None
    assert result["best_fit"] == "n_squared"
    assert _r2_for(result, "n_squared") > 0.98


async def test_programs_with_no_confident_size_parameter_degrade_to_none(
    executor_client: ExecutorClient,
) -> None:
    source = (PROGRAMS_DIR / "infinite_loop.py").read_text()
    result = await analyze_complexity(source, executor_client)
    assert result is None


async def test_naive_recursive_fibonacci_does_not_hang(executor_client: ExecutorClient) -> None:
    # Exponential blowup should hit the counters-only cap and bail out fast
    # (excluded samples => too few points => None), not hang the analysis.
    import asyncio

    source = (PROGRAMS_DIR / "fibonacci_recursion.py").read_text()
    result = await asyncio.wait_for(analyze_complexity(source, executor_client), timeout=10)
    assert result is None
