"""viz_planner's narration half (docs/PRD.md §4.3, CLAUDE.md "Deterministic
means deterministic": "viz_planner's narration ... call[s] the model"). The
panel plan itself — which panels, what they bind to — is entirely
`app/analysis/viz_planner.py`'s deterministic output, already validated
against the panel registry with hallucinated types dropped before this
module ever sees it. This only adds a one-sentence, human-readable summary
of *why* this plan was chosen.

Returned separately from `plan`, never merged into it: `VizPlan` in
packages/contracts/viz-plan.schema.json is `additionalProperties: false`,
same reasoning as insight_narrator.py/complexity_narrator.py.
"""

from __future__ import annotations

from typing import Any

from app.agents.llm_client import LLMClient
from app.agents.schemas import VIZ_PLAN_NARRATION_SCHEMA

SYSTEM_PROMPT = (
    "You are OOCC's visualization planner narrator. A deterministic plan "
    "already chose these panels and bindings. Write one plain-language "
    "sentence explaining what the panel layout will show the learner."
)


async def narrate_plan(*, plan: dict[str, Any], llm_client: LLMClient | None) -> str | None:
    if llm_client is None:
        return None

    try:
        result = await llm_client.generate_json(
            system=SYSTEM_PROMPT,
            prompt=f"Plan (JSON):\n{plan}",
            response_schema=VIZ_PLAN_NARRATION_SCHEMA,
            thinking_budget=0,
        )
    except Exception:  # noqa: BLE001 — the plan is already valid and usable without a summary
        return None

    summary = result.get("summary")
    return summary if isinstance(summary, str) else None
