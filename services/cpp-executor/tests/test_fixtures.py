"""Regression test for the six committed C++ fixtures (PRD §3.5 build step
7): every committed *.trace.json/.analysis.json/.plan.json must still
validate against the current contract, and source_hash must match the
committed .cpp source — catching a fixture regenerated against one version
of a program but committed alongside a since-edited .cpp file, or a schema
change that silently broke old fixture output.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from cpp_executor.instrument import source_hash  # noqa: E402
from oocc_contracts import validate_analysis, validate_trace  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parents[2].parent / "fixtures" / "cpp"

FIXTURE_NAMES = [
    "linked_list_reversal",
    "vector_sort",
    "bst_insert",
    "dfs_adjacency_list",
    "pointer_aliasing",
    "out_of_bounds_write",
]


@pytest.mark.parametrize("name", FIXTURE_NAMES)
def test_fixture_trace_is_schema_valid_and_hash_matches(name: str):
    trace = json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())
    validate_trace(trace)

    program = (FIXTURES_DIR / "programs" / f"{name}.cpp").read_text()
    assert trace["source_hash"] == source_hash(program)
    assert trace["language"] == "cpp"


@pytest.mark.parametrize("name", FIXTURE_NAMES)
def test_fixture_analysis_is_schema_valid(name: str):
    analysis = json.loads((FIXTURES_DIR / f"{name}.analysis.json").read_text())
    validate_analysis(analysis)


def test_out_of_bounds_fixture_demonstrates_trap_recovery():
    trace = json.loads((FIXTURES_DIR / "out_of_bounds_write.trace.json").read_text())
    assert trace["status"] == "runtime_error"
    assert trace["error"]["type"] == "wasm_trap"
    assert len(trace["steps"]) > 0  # the whole point: partial progress survives the trap
    last_step = trace["steps"][-1]
    assert last_step["heap"]  # the last good step still shows real program state


def test_linked_list_fixture_renders_as_linked_list_structure():
    analysis = json.loads((FIXTURES_DIR / "linked_list_reversal.analysis.json").read_text())
    kinds = [s["kind"] for s in analysis["structures"]]
    assert "linked_list" in kinds

    plan = json.loads((FIXTURES_DIR / "linked_list_reversal.plan.json").read_text())
    panel_types = [p["type"] for p in plan["panels"]]
    assert "linked_list" in panel_types
