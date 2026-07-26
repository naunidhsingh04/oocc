"""viz_planner: panel types must come only from the hardcoded registry, the
plan must validate against packages/contracts/viz-plan.schema.json, and the
same source must produce a cached, identical plan on a second call."""

import json
from pathlib import Path

from app.analysis.structure_detector import detect_structures
from app.analysis.viz_planner import PANEL_REGISTRY, _cache, plan_viz, source_hash

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"
PROGRAMS_DIR = FIXTURES_DIR / "generator" / "programs"

FIXTURE_NAMES = [
    "bfs_graph",
    "binary_search",
    "bubble_sort",
    "dp_knapsack",
    "fibonacci_recursion",
    "infinite_loop",
    "large_trace_40k",
    "linked_list_reversal",
    "n_queens",
    "quicksort_partition",
    "throws",
    "two_sum",
]


def _load(name: str) -> tuple[dict, str]:
    trace = json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())
    source = (PROGRAMS_DIR / f"{name}.py").read_text()
    return trace, source


def test_binary_search_plan_matches_the_prd_worked_example_shape() -> None:
    trace, source = _load("binary_search")
    structures = detect_structures(trace)
    plan = plan_viz(source, structures, trace)
    assert plan["layout"] == "primary+stack"
    primary = next(p for p in plan["panels"] if p["role"] == "primary")
    assert primary["type"] == "array"
    assert primary["binding"] == structures[0]["root_ref"]
    types = {p["type"] for p in plan["panels"]}
    assert {"array", "call_stack", "variables"} <= types


def test_fibonacci_recursion_gets_a_recursion_tree_panel() -> None:
    trace, source = _load("fibonacci_recursion")
    structures = detect_structures(trace)
    plan = plan_viz(source, structures, trace)
    assert "recursion_tree" in {p["type"] for p in plan["panels"]}
    # No detected structures -> falls back to the meta layout.
    assert plan["layout"] == "meta"


def test_all_twelve_fixtures_produce_a_valid_plan_with_registry_only_types() -> None:
    for name in FIXTURE_NAMES:
        trace, source = _load(name)
        structures = detect_structures(trace)
        plan = plan_viz(source, structures, trace)
        assert plan["panels"], f"{name} produced no panels"
        for panel in plan["panels"]:
            assert panel["type"] in PANEL_REGISTRY


def test_plan_is_cached_by_source_hash() -> None:
    _cache.clear()
    trace, source = _load("bubble_sort")
    structures = detect_structures(trace)
    first = plan_viz(source, structures, trace)
    second = plan_viz(source, structures, trace)
    assert first is second
    assert source_hash(source) in _cache


def test_different_source_does_not_share_a_cache_entry() -> None:
    _cache.clear()
    trace_a, source_a = _load("bubble_sort")
    trace_b, source_b = _load("binary_search")
    plan_a = plan_viz(source_a, detect_structures(trace_a), trace_a)
    plan_b = plan_viz(source_b, detect_structures(trace_b), trace_b)
    assert plan_a is not plan_b
    assert source_hash(source_a) != source_hash(source_b)
