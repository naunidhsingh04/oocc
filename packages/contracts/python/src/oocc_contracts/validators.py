"""Runtime validators for the OOCC trace and viz-plan contracts.

Each validator checks a raw dict against the canonical JSON Schema — which
enforces conditional rules the generated Pydantic models don't express on
their own (e.g. `error` is required when `status` is runtime_error or
compile_error; `returned` is present iff `event == "return"`) — and then
parses it into the corresponding Pydantic model for typed downstream use.
"""

from __future__ import annotations

import json
from functools import cache
from importlib import resources
from typing import Any

from jsonschema import Draft202012Validator

from oocc_contracts.generated.analysis_model import Analysis
from oocc_contracts.generated.trace_model import Trace
from oocc_contracts.generated.viz_plan_model import VizPlan

__all__ = [
    "ContractValidationError",
    "validate_analysis",
    "validate_trace",
    "validate_viz_plan",
]


class ContractValidationError(ValueError):
    """Raised when a payload does not conform to a contract schema."""

    def __init__(self, schema_filename: str, errors: list[str]) -> None:
        self.schema_filename = schema_filename
        self.errors = errors
        joined = "\n".join(f"  - {e}" for e in errors)
        super().__init__(f"{schema_filename} failed schema validation:\n{joined}")


@cache
def _load_validator(schema_filename: str) -> Draft202012Validator:
    schema_text = resources.files("oocc_contracts.generated").joinpath(schema_filename).read_text()
    schema = json.loads(schema_text)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _validate(schema_filename: str, data: dict[str, Any]) -> None:
    validator = _load_validator(schema_filename)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    if errors:
        messages = [f"{list(e.absolute_path)}: {e.message}" for e in errors]
        raise ContractValidationError(schema_filename, messages)


def validate_trace(data: dict[str, Any]) -> Trace:
    """Validate a raw trace payload against trace.schema.json and parse it.

    Raises ContractValidationError on any schema violation.
    """
    _validate("trace.schema.json", data)
    return Trace.model_validate(data)


def validate_viz_plan(data: dict[str, Any]) -> VizPlan:
    """Validate a raw viz-plan payload against viz-plan.schema.json and parse it.

    Raises ContractValidationError on any schema violation.
    """
    _validate("viz-plan.schema.json", data)
    return VizPlan.model_validate(data)


def validate_analysis(data: dict[str, Any]) -> Analysis:
    """Validate a raw analysis payload against analysis.schema.json and parse it.

    Raises ContractValidationError on any schema violation.
    """
    _validate("analysis.schema.json", data)
    return Analysis.model_validate(data)
