"""insight_scanner's seven detectors: one synthetic test per detector proving
it fires on a genuine instance of the pattern, plus real-fixture checks that
prove it does NOT fire on legitimate code that merely looks similar (the
false-positive traps this module has already hit once — see the empty-list
degenerate case fixed alongside this test file)."""

import json
from pathlib import Path

from app.analysis.insight_scanner import scan_insights

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"
PROGRAMS_DIR = FIXTURES_DIR / "generator" / "programs"


def _load(name: str) -> tuple[dict, str]:
    trace = json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())
    source = (PROGRAMS_DIR / f"{name}.py").read_text()
    return trace, source


def _kinds(insights: list[dict]) -> set[str]:
    return {i["kind"] for i in insights}


def test_runaway_loop_detected_on_infinite_loop_fixture() -> None:
    trace, source = _load("infinite_loop")
    insights = scan_insights(trace, source)
    assert "runaway_loop" in _kinds(insights)


def test_off_by_one_detected_on_index_error() -> None:
    source = "def f(xs):\n    return xs[len(xs)]\n\nf([1, 2, 3])\n"
    trace = {
        "steps": [{"i": 0, "line": 2}],
        "error": {"type": "IndexError", "message": "list index out of range", "step": 0},
    }
    insights = scan_insights(trace, source)
    assert "off_by_one" in _kinds(insights)


def test_off_by_one_does_not_fire_on_unrelated_error_type() -> None:
    # throws.py's ZeroDivisionError is a real bug, but not the specific
    # off-by-one pattern (IndexError/KeyError) this detector targets.
    trace, source = _load("throws")
    insights = scan_insights(trace, source)
    assert "off_by_one" not in _kinds(insights)


def test_mutation_during_iteration_fires_on_direct_iteration_mutation() -> None:
    source = (
        "def drop_evens(xs):\n"
        "    for x in xs:\n"
        "        if x % 2 == 0:\n"
        "            xs.remove(x)\n"
        "    return xs\n"
        "\n"
        "drop_evens([1, 2, 3, 4])\n"
    )
    frame = {"frame_id": "f1", "func": "drop_evens", "locals": {"xs": {"ref": "o1"}}}
    trace = {
        "steps": [
            {"i": 0, "line": 2, "stack": [frame], "changed": []},
            {"i": 1, "line": 4, "stack": [frame], "changed": ["o1"]},
        ]
    }
    insights = scan_insights(trace, source)
    assert "mutation_during_iteration" in _kinds(insights)


def test_mutation_during_iteration_does_not_fire_on_index_based_in_place_algorithms() -> None:
    # bubble_sort mutates its own array inside a loop, but iterates by
    # `range(len(...))`, never `for x in arr:` directly — this must not be
    # flagged (see Errors #10 in project history: this was a real false
    # positive before the AST-informed rewrite).
    trace, source = _load("bubble_sort")
    insights = scan_insights(trace, source)
    assert "mutation_during_iteration" not in _kinds(insights)


def test_accidental_quadratic_fires_on_in_operator_inside_loop() -> None:
    trace, source = _load("two_sum")
    insights = scan_insights(trace, source)
    assert "accidental_quadratic" in _kinds(insights)


def test_accidental_quadratic_does_not_fire_on_append_only_list_from_empty() -> None:
    # bfs_graph's `order` list is append-only (never front-inserted); its
    # very first growth event is 0 -> 1 elements, which is positionally
    # ambiguous and must be skipped rather than misread as a front-insert.
    trace, source = _load("bfs_graph")
    insights = scan_insights(trace, source)
    assert "accidental_quadratic" not in _kinds(insights)


def test_shadowed_builtin_detected_on_linked_list_reversal_fixture() -> None:
    # linked_list_reversal names a local `next`, shadowing the builtin.
    trace, source = _load("linked_list_reversal")
    insights = scan_insights(trace, source)
    assert "shadowed_builtin" in _kinds(insights)


def test_dead_variable_detected_on_synthetic_unused_assignment() -> None:
    source = "def f():\n    unused = 1\n    return 2\n\nf()\n"
    trace = {"steps": [{"i": 0, "line": 2}]}
    insights = scan_insights(trace, source)
    assert "dead_variable" in _kinds(insights)


def test_redundant_recomputation_detected_on_naive_fibonacci() -> None:
    trace, source = _load("fibonacci_recursion")
    insights = scan_insights(trace, source)
    assert "redundant_recomputation" in _kinds(insights)


def test_every_insight_carries_kind_severity_and_step_refs() -> None:
    for name in ("bfs_graph", "bubble_sort", "two_sum", "fibonacci_recursion", "infinite_loop"):
        trace, source = _load(name)
        for insight in scan_insights(trace, source):
            assert insight["kind"]
            assert insight["severity"] in ("info", "warning", "error")
            assert insight["step_refs"]
            assert all(isinstance(s, int) for s in insight["step_refs"])
