import copy

import pytest
from oocc_contracts import (
    ContractValidationError,
    validate_analysis,
    validate_trace,
    validate_viz_plan,
)


def minimal_trace() -> dict:
    return {
        "schema_version": "1.0",
        "run_id": "r_abc123",
        "language": "python",
        "source_hash": "sha256:" + "a" * 64,
        "status": "ok",
        "meta": {
            "duration_ms": 1,
            "step_count": 1,
            "truncated": False,
            "stdin": "",
            "peak_heap_objects": 0,
        },
        "steps": [
            {
                "i": 0,
                "event": "line",
                "line": 1,
                "func": "<module>",
                "depth": 0,
                "stack": [{"frame_id": "f0", "func": "<module>", "line": 1, "locals": {}}],
                "heap": {},
                "stdout_delta": "",
                "changed": [],
            }
        ],
    }


def test_accepts_a_minimal_well_formed_trace() -> None:
    trace = validate_trace(minimal_trace())
    assert trace.run_id == "r_abc123"
    assert trace.steps[0].event.value == "line"


def test_rejects_runtime_error_status_with_no_error_object() -> None:
    bad = minimal_trace()
    bad["status"] = "runtime_error"
    with pytest.raises(ContractValidationError):
        validate_trace(bad)


def test_rejects_a_return_step_with_no_returned() -> None:
    bad = minimal_trace()
    bad["steps"][0]["event"] = "return"
    with pytest.raises(ContractValidationError):
        validate_trace(bad)


def test_rejects_a_changed_path_that_does_not_match_the_grammar() -> None:
    bad = minimal_trace()
    bad["steps"][0]["changed"] = ["not a valid path"]
    with pytest.raises(ContractValidationError):
        validate_trace(bad)


def test_accepts_bare_null_as_a_value() -> None:
    data = copy.deepcopy(minimal_trace())
    data["steps"][0]["stack"] = [
        {"frame_id": "f0", "func": "<module>", "line": 1, "locals": {"x": None}}
    ]
    validate_trace(data)  # must not raise


def test_accepts_a_minimal_well_formed_viz_plan() -> None:
    plan = validate_viz_plan({"layout": "primary+stack", "panels": [{"id": "p1", "type": "array"}]})
    assert plan.panels[0].type == "array"


def test_rejects_a_panel_type_outside_the_registry() -> None:
    with pytest.raises(ContractValidationError):
        validate_viz_plan(
            {"layout": "primary+stack", "panels": [{"id": "p1", "type": "not_a_real_panel_type"}]}
        )


def test_accepts_the_known_pointer_and_window_annotation_kinds() -> None:
    plan = validate_viz_plan(
        {
            "layout": "primary+stack",
            "panels": [
                {
                    "id": "p1",
                    "type": "array",
                    "binding": "o1",
                    "annotations": [
                        {"kind": "pointer", "label": "lo", "bind": "frame.lo"},
                        {"kind": "window", "from": "frame.lo", "to": "frame.hi"},
                    ],
                }
            ],
        }
    )
    assert len(plan.panels[0].annotations) == 2


def test_accepts_a_minimal_well_formed_analysis_with_null_complexity() -> None:
    analysis = validate_analysis(
        {
            "structures": [{"kind": "binary_tree", "root_ref": "o5", "confidence": 0.94}],
            "insights": [{"kind": "off_by_one", "severity": "warning", "step_refs": [12, 13]}],
            "complexity": None,
        }
    )
    assert analysis.structures[0].kind.value == "binary_tree"
    assert analysis.complexity is None


def test_accepts_a_populated_complexity_report() -> None:
    analysis = validate_analysis(
        {
            "structures": [],
            "insights": [],
            "complexity": {
                "parameter": "arr",
                "samples": [{"n": 10, "shape": "random", "step_count": 42}],
                "fits": [{"model": "n", "r_squared": 0.99, "coefficients": {"a": 1, "b": 0}}],
                "best_fit": "n",
            },
        }
    )
    assert analysis.complexity is not None
    assert analysis.complexity.best_fit.value == "n"


def test_rejects_a_structure_kind_outside_the_registry() -> None:
    with pytest.raises(ContractValidationError):
        validate_analysis(
            {
                "structures": [{"kind": "not_a_real_kind", "root_ref": "o1", "confidence": 0.5}],
                "insights": [],
                "complexity": None,
            }
        )
