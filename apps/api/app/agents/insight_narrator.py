"""insight_scanner's LLM narration half (docs/PRD.md §4.3): the model
writes prose for findings the deterministic detectors in
`app/analysis/insight_scanner.py` already computed — it never decides
*whether* something is a bug, only *how to say it's one*. If narration
fails or comes back the wrong shape, every insight still has its factual
`kind`/`severity`/`step_refs`/`detail` — narration is additive, never
required for the insight to be usable.

Narrations are returned as a list *parallel to* `insights`, never merged
into the finding objects themselves: `Insight` in
packages/contracts/analysis.schema.json is `additionalProperties: false`
and its own docstring already anticipates this ("Phase 3's narrator turns
this into prose") as a separate artifact, not a new field — keeping
narration out-of-band means `analysis.insights` sent to
`oocc_contracts.validate_analysis` never has to change shape.
"""

from __future__ import annotations

from typing import Any

from app.agents.llm_client import LLMClient
from app.agents.schemas import INSIGHT_NARRATION_SCHEMA

SYSTEM_PROMPT = (
    "You are OOCC's insight narrator. Each finding below was already "
    "detected deterministically — kind, severity, and the real step "
    "indices it's evidenced by are all facts, not something for you to "
    "judge. Write one short, plain-language sentence per finding "
    "explaining what happened and why it matters to someone learning to "
    "code. Return exactly one narration string per finding, in the same "
    "order."
)


def _build_prompt(insights: list[dict[str, Any]]) -> str:
    lines = [
        f"{i}. kind={f['kind']} severity={f['severity']} detail={f.get('detail', '')} "
        f"step_refs={f['step_refs']}"
        for i, f in enumerate(insights)
    ]
    return "Findings:\n" + "\n".join(lines)


async def narrate_insights(
    *, insights: list[dict[str, Any]], llm_client: LLMClient | None
) -> list[str | None]:
    """One narration string per insight, `None` where narration wasn't
    possible — always the same length as `insights`, so callers can zip
    them positionally."""
    if not insights:
        return []
    if llm_client is None:
        return [None] * len(insights)

    try:
        result = await llm_client.generate_json(
            system=SYSTEM_PROMPT,
            prompt=_build_prompt(insights),
            response_schema=INSIGHT_NARRATION_SCHEMA,
            thinking_budget=0,
        )
    except Exception:  # noqa: BLE001 — narration is additive; a failure never drops a finding
        return [None] * len(insights)

    narrations = result.get("narrations")
    if not isinstance(narrations, list) or len(narrations) != len(insights):
        return [None] * len(insights)

    return [str(narration) for narration in narrations]
