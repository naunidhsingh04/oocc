"""structure_detector must classify by shape, never by name — the
synthetic-heap tests below deliberately use non-suggestive field/class
names (`N`, `l`, `r`) to prove that. The fixture tests are the real-world
check: twelve genuine traces, no hand-tuning."""

import json
from pathlib import Path

from app.analysis.structure_detector import detect_structures

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


def test_binary_tree_detected_from_shape_not_name() -> None:
    trace = {
        "steps": [
            {
                "i": 0,
                "heap": {
                    "o1": {"type": "N", "fields": {"l": {"ref": "o2"}, "r": {"ref": "o3"}}},
                    "o2": {
                        "type": "N",
                        "fields": {
                            "l": {"val": None, "repr": "None"},
                            "r": {"val": None, "repr": "None"},
                        },
                    },
                    "o3": {
                        "type": "N",
                        "fields": {"l": {"ref": "o4"}, "r": {"val": None, "repr": "None"}},
                    },
                    "o4": {
                        "type": "N",
                        "fields": {
                            "l": {"val": None, "repr": "None"},
                            "r": {"val": None, "repr": "None"},
                        },
                    },
                },
            }
        ]
    }
    structures = detect_structures(trace)
    assert structures == [{"kind": "binary_tree", "root_ref": "o1", "confidence": 0.95}]


def test_singly_linked_chain_detected_as_linked_list() -> None:
    trace = {
        "steps": [
            {
                "i": 0,
                "heap": {
                    "o1": {"type": "Box", "fields": {"nxt": {"ref": "o2"}}},
                    "o2": {"type": "Box", "fields": {"nxt": {"ref": "o3"}}},
                    "o3": {"type": "Box", "fields": {"nxt": {"val": None, "repr": "None"}}},
                },
            }
        ]
    }
    structures = detect_structures(trace)
    assert structures == [{"kind": "linked_list", "root_ref": "o1", "confidence": 0.9}]


def test_cyclic_chain_still_yields_a_linked_list_with_a_note() -> None:
    trace = {
        "steps": [
            {
                "i": 0,
                "heap": {
                    "o1": {"type": "Box", "fields": {"nxt": {"ref": "o2"}}},
                    "o2": {"type": "Box", "fields": {"nxt": {"ref": "o1"}}},  # cycle back to o1
                },
            }
        ]
    }
    structures = detect_structures(trace)
    assert len(structures) == 1
    assert structures[0]["kind"] == "linked_list"
    assert "note" in structures[0]


def test_bfs_graph_fixture_detects_the_adjacency_dict_as_a_graph() -> None:
    trace = _load("bfs_graph")
    structures = detect_structures(trace)
    kinds = {s["kind"] for s in structures}
    assert "graph" in kinds
    # Adjacency lists are part of the graph, not independent arrays.
    graph = next(s for s in structures if s["kind"] == "graph")
    array_refs = {s["root_ref"] for s in structures if s["kind"] == "array"}
    assert graph["root_ref"] not in array_refs


def test_bfs_graph_fixture_detects_its_actual_queue() -> None:
    # bfs's frontier list (append + pop(0)) must classify as a queue, not
    # fall back to plain "array" — regression test for the degenerate
    # empty-list transition that used to corrupt this classification.
    structures = detect_structures(_load("bfs_graph"))
    assert any(s["kind"] == "queue" for s in structures)


def test_linked_list_reversal_fixture_detects_a_linked_list() -> None:
    trace = _load("linked_list_reversal")
    structures = detect_structures(trace)
    assert any(s["kind"] == "linked_list" for s in structures)


def test_n_queens_fixture_detects_array_2d_and_stack() -> None:
    trace = _load("n_queens")
    kinds = {s["kind"] for s in detect_structures(trace)}
    assert kinds == {"array_2d", "stack"}


def test_two_sum_fixture_detects_hash_map() -> None:
    trace = _load("two_sum")
    kinds = {s["kind"] for s in detect_structures(trace)}
    assert "hash_map" in kinds


def test_dp_knapsack_fixture_detects_array_2d() -> None:
    trace = _load("dp_knapsack")
    kinds = {s["kind"] for s in detect_structures(trace)}
    assert "array_2d" in kinds


def test_programs_with_no_containers_detect_nothing() -> None:
    assert detect_structures(_load("fibonacci_recursion")) == []
    assert detect_structures(_load("infinite_loop")) == []
    assert detect_structures(_load("large_trace_40k")) == []


def test_queue_access_pattern_detected_from_append_and_pop_zero() -> None:
    # Same shape as bfs_graph's own queue (list.append + list.pop(0)), built
    # directly to isolate the access-pattern classifier from graph detection.
    trace = {
        "steps": [
            {"i": 0, "heap": {"o1": {"type": "list", "len": 0, "items": []}}},
            {
                "i": 1,
                "heap": {"o1": {"type": "list", "len": 1, "items": [{"val": 1}]}},
            },
            {
                "i": 2,
                "heap": {"o1": {"type": "list", "len": 2, "items": [{"val": 1}, {"val": 2}]}},
            },
            {"i": 3, "heap": {"o1": {"type": "list", "len": 1, "items": [{"val": 2}]}}},
        ]
    }
    structures = detect_structures(trace)
    assert structures == [{"kind": "queue", "root_ref": "o1", "confidence": 0.85}]


def test_stack_access_pattern_detected_from_append_and_pop_end() -> None:
    trace = {
        "steps": [
            {"i": 0, "heap": {"o1": {"type": "list", "len": 0, "items": []}}},
            {"i": 1, "heap": {"o1": {"type": "list", "len": 1, "items": [{"val": 1}]}}},
            {
                "i": 2,
                "heap": {"o1": {"type": "list", "len": 2, "items": [{"val": 1}, {"val": 2}]}},
            },
            {"i": 3, "heap": {"o1": {"type": "list", "len": 1, "items": [{"val": 1}]}}},
        ]
    }
    structures = detect_structures(trace)
    assert structures == [{"kind": "stack", "root_ref": "o1", "confidence": 0.85}]
