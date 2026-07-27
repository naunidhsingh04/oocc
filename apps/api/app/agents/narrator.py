"""narrator — the pipeline's final convergent node (docs/PRD.md §4.2):
step-range summaries in plain language, e.g. "steps 0-15: the outer loop
makes its first full pass." Reads the digest only, never the raw trace.
Every `step_range` is validated against the trace's real step indices
after the call; a range that falls outside the trace is dropped rather
than shipped — the same "no claim without a real step index" rule the
tutor's `step_refs` are held to (PRD §1).
"""

from __future__ import annotations

from typing import Any

from app.agents.digest import Digest
from app.agents.llm_client import LLMClient
from app.agents.schemas import STEP_RANGE_NARRATION_SCHEMA

SYSTEM_PROMPT = (
    "You are OOCC's narrator. Given a compressed execution digest, write a "
    "handful of short plain-language summaries, each covering one "
    "meaningful contiguous range of steps (a loop pass, a call, a "
    "notable transition). step_range must be [start, end] using real step "
    "indices that appear in the digest (loop_skeleton ranges, hot_lines, "
    "call_graph) — never invented indices."
)


def _build_prompt(digest: Digest) -> str:
    return f"Execution digest (JSON):\n{digest.model_dump_json()}"


async def narrate_step_ranges(
    *, digest: Digest, llm_client: LLMClient | None
) -> list[dict[str, Any]]:
    if llm_client is None:
        return []

    try:
        result = await llm_client.generate_json(
            system=SYSTEM_PROMPT,
            prompt=_build_prompt(digest),
            response_schema=STEP_RANGE_NARRATION_SCHEMA,
            thinking_budget=0,
        )
    except Exception:  # noqa: BLE001 — narration is optional; the pipeline still returns everything else
        return []

    ranges = result.get("ranges")
    if not isinstance(ranges, list):
        return []

    last_step = digest.step_count - 1
    validated: list[dict[str, Any]] = []
    for entry in ranges:
        if not isinstance(entry, dict):
            continue
        step_range = entry.get("step_range")
        summary = entry.get("summary")
        if not isinstance(step_range, list) or len(step_range) != 2 or not isinstance(summary, str):
            continue
        start, end = step_range
        if not isinstance(start, int) or not isinstance(end, int):
            continue
        if not (0 <= start <= end <= last_step):
            continue
        validated.append({"step_range": [start, end], "summary": summary})

    return validated
