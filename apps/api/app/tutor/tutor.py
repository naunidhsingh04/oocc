"""The tutor's answer-generation core (docs/PRD.md §4.3, §1's "no claim
without a real step index"). `answer_question` gets a structured
`{answer, step_refs}` from the model (not a raw text stream — see
`app/routers/tutor.py`'s docstring for why the SSE framing is layered on
top of this, not inside it), validates every `step_refs` entry against the
trace's real step indices, and retries once with a stronger instruction if
validation fails. Two failed attempts degrade to a safe, honest fallback
answer rather than shipping an unverifiable claim.
"""

from __future__ import annotations

from typing import Any

from app.agents.digest import Digest
from app.agents.llm_client import LLMClient
from app.agents.schemas import TUTOR_RESPONSE_SCHEMA
from app.rag.concept_store import ConceptChunk
from app.tutor.context import TutorTurn, build_prompt, build_system_prompt, count_solution_requests

FALLBACK_ANSWER = (
    "I couldn't ground an answer to that in a real step of this run — could "
    "you point me at a specific line or step you're curious about?"
)

RETRY_SUFFIX = (
    "\nYour previous answer either had no step_refs or cited a step index "
    "that doesn't exist in the digest/step window. If your answer discusses "
    "what the code actually did, cite only real indices you can see there. "
    "If the question is a general concept question unrelated to this run, "
    "step_refs may be empty."
)


class TutorAnswer:
    def __init__(self, *, answer: str, step_refs: list[int], degraded: bool) -> None:
        self.answer = answer
        self.step_refs = step_refs
        self.degraded = degraded


def _is_about_the_users_code(question: str) -> bool:
    """A crude, deterministic heuristic — good enough to decide whether a
    zero-step_refs answer is acceptable (a general concept question) or
    must be retried (anything referencing "this", "my code", "it", the run
    itself). Errs toward requiring evidence: only skips the retry for
    clearly-general phrasing."""
    generic_markers = ("what is", "what's the difference", "explain ", "define ")
    lowered = question.lower().strip()
    return not any(lowered.startswith(marker) for marker in generic_markers)


async def answer_question(
    *,
    digest: Digest,
    trace: dict[str, Any],
    current_step: int,
    curriculum_chunks: list[ConceptChunk],
    history: list[TutorTurn],
    question: str,
    llm_client: LLMClient,
) -> TutorAnswer:
    valid_step_indices = {step["i"] for step in trace.get("steps", [])}
    solution_request_count = count_solution_requests(history=history, question=question)
    system = build_system_prompt(solution_request_count=solution_request_count)
    prompt = build_prompt(
        digest=digest,
        trace=trace,
        current_step=current_step,
        curriculum_chunks=curriculum_chunks,
        history=history,
        question=question,
    )
    requires_evidence = _is_about_the_users_code(question)

    for attempt in range(2):
        call_system = system if attempt == 0 else system + RETRY_SUFFIX
        try:
            result = await llm_client.generate_json(
                system=call_system,
                prompt=prompt,
                response_schema=TUTOR_RESPONSE_SCHEMA,
                thinking_budget=1024,
            )
        except Exception:  # noqa: BLE001 — degrade to the safe fallback, never crash the request
            continue

        answer = result.get("answer")
        step_refs = result.get("step_refs") or []
        if not isinstance(answer, str):
            continue

        step_refs_valid = all(isinstance(i, int) and i in valid_step_indices for i in step_refs)
        if not step_refs_valid:
            continue
        if requires_evidence and not step_refs:
            continue

        return TutorAnswer(answer=answer, step_refs=[int(i) for i in step_refs], degraded=False)

    return TutorAnswer(answer=FALLBACK_ANSWER, step_refs=[], degraded=True)
