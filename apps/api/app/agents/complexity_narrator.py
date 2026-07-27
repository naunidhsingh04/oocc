"""complexity_analyst's LLM half (docs/PRD.md §4.3): "LLM only writes the
one-paragraph explanation and names the dominant operation." The measured
curve and its R² come entirely from `app/analysis/complexity_analyst.py`'s
empirical fit — the model never sees raw samples and can't change the
verdict, only explain it.

Returns the explanation separately from `complexity`, never merged into
it: `ComplexityReport` in packages/contracts/analysis.schema.json is
`additionalProperties: false`, so adding fields here would break
`oocc_contracts.validate_analysis` on the very next call — see
insight_narrator.py's docstring for the identical reasoning.
"""

from __future__ import annotations

from typing import Any, TypedDict

from app.agents.llm_client import LLMClient
from app.agents.schemas import COMPLEXITY_NARRATION_SCHEMA

SYSTEM_PROMPT = (
    "You are OOCC's complexity narrator. A deterministic curve fit already "
    "measured this program's growth rate empirically — do not contradict "
    "or re-derive it. Write one short paragraph explaining why the code "
    "has this complexity in plain language, and name the single dominant "
    "operation responsible for it."
)


class ComplexityNarration(TypedDict):
    explanation: str
    dominant_operation: str


def _build_prompt(complexity: dict[str, Any], source: str) -> str:
    return (
        f"Source code:\n{source}\n\n"
        f"Measured complexity (JSON):\n{complexity}\n\n"
        "Explain the result."
    )


async def narrate_complexity(
    *,
    complexity: dict[str, Any] | None,
    source: str,
    llm_client: LLMClient | None,
) -> ComplexityNarration | None:
    if complexity is None or llm_client is None:
        return None

    try:
        result = await llm_client.generate_json(
            system=SYSTEM_PROMPT,
            prompt=_build_prompt(complexity, source),
            response_schema=COMPLEXITY_NARRATION_SCHEMA,
            thinking_budget=0,
        )
    except Exception:  # noqa: BLE001 — narration is additive over the already-valid measurement
        return None

    explanation = result.get("explanation")
    dominant_operation = result.get("dominant_operation")
    if not isinstance(explanation, str) or not isinstance(dominant_operation, str):
        return None

    return {"explanation": explanation, "dominant_operation": dominant_operation}
