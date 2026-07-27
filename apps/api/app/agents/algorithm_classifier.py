"""algorithm_classifier — Gemini 2.5 Flash, structured output,
`thinking_budget: 0` (docs/PRD.md §4.3). The only input is the digest (never
the raw trace) plus the source. `evidence_steps` must reference real step
indices in the trace; a response that fails validation is retried once with
a stronger instruction, and if the retry also fails, this degrades to
`None` rather than shipping an unverifiable claim — the one rule that
defines the product (PRD §1) applies to the model's own output as much as
to any deterministic node's.
"""

from __future__ import annotations

from typing import Any

from app.agents.digest import Digest
from app.agents.llm_client import LLMClient
from app.agents.schemas import ALGORITHM_CLASSIFICATION_SCHEMA

SYSTEM_PROMPT = (
    "You are OOCC's algorithm classifier. Given a compressed digest of a "
    "program's real execution trace and its source code, identify the "
    "algorithm and its family (e.g. sorting, searching, graph traversal, "
    "dynamic programming). evidence_steps MUST be real step indices from "
    "the digest that support your classification — never invent an index."
)

RETRY_SUFFIX = (
    "\nYour previous answer's evidence_steps did not match any real step "
    "index from the digest. Look only at the digest's hot_lines and "
    "loop_skeleton data for real step indices, and try again."
)


def _build_prompt(digest: Digest, source: str) -> str:
    return (
        f"Source code:\n{source}\n\n"
        f"Execution digest (JSON):\n{digest.model_dump_json()}\n\n"
        "Classify the algorithm."
    )


async def classify_algorithm(
    *,
    digest: Digest,
    source: str,
    trace: dict[str, Any],
    llm_client: LLMClient | None,
) -> dict[str, Any] | None:
    if llm_client is None:
        return None

    valid_step_indices = {step["i"] for step in trace.get("steps", [])}
    prompt = _build_prompt(digest, source)

    for attempt in range(2):
        system = SYSTEM_PROMPT if attempt == 0 else SYSTEM_PROMPT + RETRY_SUFFIX
        try:
            result = await llm_client.generate_json(
                system=system,
                prompt=prompt,
                response_schema=ALGORITHM_CLASSIFICATION_SCHEMA,
                thinking_budget=0,
            )
        except Exception:  # noqa: BLE001 — any LLM/parse failure degrades, never crashes the pipeline
            continue

        evidence_steps = result.get("evidence_steps") or []
        if evidence_steps and all(i in valid_step_indices for i in evidence_steps):
            return {
                "algorithm": str(result.get("algorithm", "")),
                "family": str(result.get("family", "")),
                "confidence": float(result.get("confidence", 0.0)),
                "evidence_steps": [int(i) for i in evidence_steps],
            }

    return None
