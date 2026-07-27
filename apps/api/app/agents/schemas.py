"""JSON Schemas for every structured Gemini call in the pipeline
(`response_json_schema` — docs/PRD.md §4.3). Kept as plain dicts, not
Pydantic models: these describe what we ask the *model* to return, which is
validated against the *real* trace/registry afterward in Python — the
schema alone can't express "evidence_steps must be real indices" or "kind
must be one already in the panel registry", so it isn't the whole
contract, just the first filter.
"""

from __future__ import annotations

from typing import Any

ALGORITHM_CLASSIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "algorithm": {"type": "string"},
        "family": {"type": "string"},
        "confidence": {"type": "number"},
        "evidence_steps": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["algorithm", "family", "confidence", "evidence_steps"],
}

STRUCTURE_RECLASSIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "kind": {
            "type": "string",
            "enum": [
                "array",
                "array_2d",
                "linked_list",
                "binary_tree",
                "graph",
                "stack",
                "queue",
                "hash_map",
            ],
        },
        "confidence": {"type": "number"},
    },
    "required": ["kind", "confidence"],
}

INSIGHT_NARRATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "narrations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["narrations"],
}

COMPLEXITY_NARRATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "explanation": {"type": "string"},
        "dominant_operation": {"type": "string"},
    },
    "required": ["explanation", "dominant_operation"],
}

VIZ_PLAN_NARRATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"summary": {"type": "string"}},
    "required": ["summary"],
}

STEP_RANGE_NARRATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "ranges": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step_range": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                    "summary": {"type": "string"},
                },
                "required": ["step_range", "summary"],
            },
        }
    },
    "required": ["ranges"],
}

TUTOR_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "step_refs": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["answer", "step_refs"],
}
