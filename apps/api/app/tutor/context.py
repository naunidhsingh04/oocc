"""Assembles the tutor's per-question context exactly as docs/PRD.md §4.3
item 4 specifies: system prompt, digest, a 5-step window around the
scrubber, top-3 curriculum chunks, and the last 6 turns. The model never
sees the raw trace — only the digest and this small step window, both
already-compressed facts, same principle as every other agent node
(PRD §4.1).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from app.agents.digest import Digest
from app.rag.concept_store import ConceptChunk

STEP_WINDOW_RADIUS = 2  # 5 steps total: current step +/- 2
MAX_HISTORY_TURNS = 6

_SOLUTION_REQUEST_PHRASES = (
    "give me the answer",
    "just tell me",
    "full solution",
    "the full code",
    "show me the code",
    "what's the answer",
    "solve it for me",
    "just give me",
    "write the code for me",
)


class TutorTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


def looks_like_solution_request(question: str) -> bool:
    lowered = question.lower()
    return any(phrase in lowered for phrase in _SOLUTION_REQUEST_PHRASES)


def count_solution_requests(*, history: list[TutorTurn], question: str) -> int:
    """How many times, across this conversation including the current
    question, the user has asked for the complete solution — the Socratic
    posture (PRD §4.3) only lifts once this reaches 2."""
    count = sum(
        1 for turn in history if turn.role == "user" and looks_like_solution_request(turn.content)
    )
    if looks_like_solution_request(question):
        count += 1
    return count


def build_system_prompt(*, solution_request_count: int) -> str:
    if solution_request_count >= 2:
        posture = (
            "The user has now asked for the complete solution at least twice — "
            "you may give it directly, plainly, this time."
        )
    else:
        posture = (
            "Do not give the complete solution. Ask a guiding question, point at "
            "the relevant step, or explain one piece at a time — help the user "
            "find the answer themselves."
        )
    return (
        "You are OOCC's tutor: a Socratic guide for someone learning to code by "
        "watching their own program run, never a generic chatbot. "
        f"{posture} "
        "You never see the raw execution trace — only a compressed digest, a "
        "small window of steps around where the user is currently scrubbed to, "
        "and curriculum context. Every factual claim about what the code did "
        "must cite the real step index it's evidenced by, in step_refs — never "
        "invent one. A question that isn't about the user's code (e.g. a "
        "general concept question) may have an empty step_refs; anything about "
        "what actually happened in this run must not. "
        "Wrap every variable name and value you mention in single backticks "
        "(e.g. `mid`, `7`) — the frontend renders backticked text in "
        "monospace with that variable's own color, which is how someone "
        "reading your answer tells `mid` in your sentence is the same `mid` "
        "highlighted in the panels."
    )


def step_window_text(*, trace: dict[str, Any], current_step: int) -> str:
    steps = trace.get("steps", [])
    if not steps:
        return "(no steps)"
    lo = max(0, current_step - STEP_WINDOW_RADIUS)
    hi = min(len(steps) - 1, current_step + STEP_WINDOW_RADIUS)
    lines = []
    for step in steps[lo : hi + 1]:
        marker = "-> " if step["i"] == current_step else "   "
        lines.append(
            f"{marker}step {step['i']}: line {step['line']} ({step['event']}) "
            f"changed={step.get('changed', [])}"
        )
    return "\n".join(lines)


def build_prompt(
    *,
    digest: Digest,
    trace: dict[str, Any],
    current_step: int,
    curriculum_chunks: list[ConceptChunk],
    history: list[TutorTurn],
    question: str,
) -> str:
    curriculum_text = "\n\n".join(f"[{c.concept_id}] {c.content}" for c in curriculum_chunks)
    history_text = "\n".join(
        f"{turn.role}: {turn.content}" for turn in history[-MAX_HISTORY_TURNS:]
    )
    return (
        f"Execution digest (JSON):\n{digest.model_dump_json()}\n\n"
        f"Step window around the user's current position (step {current_step}):\n"
        f"{step_window_text(trace=trace, current_step=current_step)}\n\n"
        f"Relevant curriculum:\n{curriculum_text}\n\n"
        f"Conversation so far:\n{history_text}\n\n"
        f"User's question: {question}"
    )
