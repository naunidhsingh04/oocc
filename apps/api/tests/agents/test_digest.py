"""digest is deterministic, no LLM (docs/PRD.md §4.1) and must stay small
enough that agents can afford to reason over it on every call — the whole
point of building it before anything that calls a model."""

import json
from pathlib import Path

import pytest
from app.agents.digest import compute_digest

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


def test_digest_of_the_40k_step_fixture_stays_within_the_2kb_budget() -> None:
    trace = _load("large_trace_40k")
    digest = compute_digest(trace)
    payload = digest.model_dump_json()
    assert len(payload.encode("utf-8")) <= 2048, (
        f"digest was {len(payload.encode('utf-8'))} bytes, over the ~2KB budget"
    )


@pytest.mark.parametrize(
    "name",
    [
        "bubble_sort",
        "binary_search",
        "fibonacci_recursion",
        "bfs_graph",
        "linked_list_reversal",
        "two_sum",
        "quicksort_partition",
        "n_queens",
        "dp_knapsack",
        "infinite_loop",
        "throws",
        "large_trace_40k",
    ],
)
def test_digest_computes_for_every_fixture_without_error(name: str) -> None:
    trace = _load(name)
    digest = compute_digest(trace)
    assert digest.step_count == len(trace["steps"])
    assert digest.status == trace["status"]


def test_loop_skeleton_detects_bubble_sorts_nested_loops() -> None:
    trace = _load("bubble_sort")
    digest = compute_digest(trace)
    assert len(digest.loop_skeleton) >= 1
    for entry in digest.loop_skeleton:
        assert entry.iterations > 0
        assert entry.line_range[1] >= entry.line_range[0]


def test_variable_histories_are_capped_and_downsampled() -> None:
    trace = _load("large_trace_40k")
    digest = compute_digest(trace)
    assert len(digest.variable_histories) <= 8
    for history in digest.variable_histories:
        assert len(history.samples) <= 40


def test_call_graph_reflects_real_recursion_in_fibonacci() -> None:
    trace = _load("fibonacci_recursion")
    digest = compute_digest(trace)
    assert any(edge.caller == "fib" and edge.callee == "fib" for edge in digest.call_graph)
    assert digest.recursion_depth_histogram
    assert max(digest.recursion_depth_histogram) > 1


def test_terminal_state_and_error_reflect_a_failed_run() -> None:
    trace = _load("throws")
    digest = compute_digest(trace)
    assert digest.terminal_state == "runtime_error"
    assert digest.error is not None
    assert digest.error["type"] == "ZeroDivisionError"


def test_stdout_tail_captures_the_last_output() -> None:
    trace = _load("binary_search")
    digest = compute_digest(trace)
    assert "index" in digest.stdout_tail


def test_hot_lines_are_bounded_and_sorted_by_count() -> None:
    trace = _load("large_trace_40k")
    digest = compute_digest(trace)
    assert len(digest.hot_lines) <= 10
    counts = [count for _line, count in digest.hot_lines]
    assert counts == sorted(counts, reverse=True)
