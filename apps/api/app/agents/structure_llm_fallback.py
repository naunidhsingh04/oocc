"""structure_detector's LLM fallback (docs/PRD.md §4.3): "LLM only as a
fallback when rules score below threshold." `app/analysis/structure_detector.py`
itself never imports this module or calls the model — see its own docstring
and CLAUDE.md "Deterministic means deterministic". This module is the
downstream consumer that decides, per-finding, whether the rule pass was
confident enough to stand on its own.

The model is only ever asked to confirm/reclassify a *kind* — never to
invent a `root_ref` — so a hallucinated answer can't point at a heap object
that doesn't exist: any `kind` outside the registry enum is rejected by the
response schema itself, and the `root_ref` is never touched.
"""

from __future__ import annotations

from typing import Any

from app.agents.llm_client import LLMClient
from app.agents.schemas import STRUCTURE_RECLASSIFICATION_SCHEMA

LOW_CONFIDENCE_THRESHOLD = 0.75
VALID_STRUCTURE_KINDS = set(STRUCTURE_RECLASSIFICATION_SCHEMA["properties"]["kind"]["enum"])

SYSTEM_PROMPT = (
    "You are OOCC's structure classifier fallback. A deterministic rule "
    "pass already classified this heap object with low confidence. Given "
    "its shape (type, fields or items), confirm or correct the "
    "classification. Classify by SHAPE only, never by any name."
)

# The cost/latency of one call per low-confidence finding is bounded by
# capping how many findings get a second opinion per run.
MAX_RECLASSIFICATIONS = 5


def _describe_shape(root_ref: str, merged_heap: dict[str, Any]) -> str:
    obj = merged_heap.get(root_ref, {})
    if "fields" in obj:
        return f"{root_ref}: instance with fields {sorted(obj['fields'].keys())}"
    if "items" in obj:
        return f"{root_ref}: {obj.get('type')} of length {obj.get('len', 0)}"
    if "entries" in obj:
        return f"{root_ref}: dict with {len(obj.get('entries', []))} entries"
    return f"{root_ref}: {obj.get('type', 'unknown')}"


async def reclassify_low_confidence(
    *,
    structures: list[dict[str, Any]],
    merged_heap: dict[str, Any],
    llm_client: LLMClient | None,
) -> list[dict[str, Any]]:
    if llm_client is None:
        return structures

    updated: list[dict[str, Any]] = []
    reclassified_count = 0

    for finding in structures:
        if (
            reclassified_count >= MAX_RECLASSIFICATIONS
            or finding.get("confidence", 1.0) >= LOW_CONFIDENCE_THRESHOLD
        ):
            updated.append(finding)
            continue

        reclassified_count += 1
        try:
            result = await llm_client.generate_json(
                system=SYSTEM_PROMPT,
                prompt=_describe_shape(finding["root_ref"], merged_heap),
                response_schema=STRUCTURE_RECLASSIFICATION_SCHEMA,
                thinking_budget=0,
            )
        except Exception:  # noqa: BLE001 — keep the deterministic finding on any failure
            updated.append(finding)
            continue

        kind = result.get("kind")
        confidence = result.get("confidence")
        if (
            not isinstance(kind, str)
            or kind not in VALID_STRUCTURE_KINDS
            or not isinstance(confidence, (int, float))
        ):
            # A hallucinated or out-of-registry kind is dropped, not
            # passed through — the deterministic finding stands.
            updated.append(finding)
            continue

        updated.append(
            {**finding, "kind": kind, "confidence": float(confidence), "note": "llm-reclassified"}
        )

    return updated
