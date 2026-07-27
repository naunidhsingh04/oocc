"""answer_question: structured output, and the "zero/hallucinated
step_refs on a code question gets retried once, then degrades" rule
(docs/PRD.md §4.3, §1)."""

import json
from pathlib import Path

import pytest
from app.agents.digest import compute_digest
from app.agents.llm_client import FakeLLMClient
from app.rag.concept_store import ConceptChunk
from app.tutor.tutor import FALLBACK_ANSWER, answer_question

pytestmark = pytest.mark.anyio

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"


def _trace(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


async def test_valid_step_refs_are_accepted_on_the_first_try() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    real_step = trace["steps"][3]["i"]
    llm_client = FakeLLMClient(
        json_responses=[{"answer": "mid landed there because...", "step_refs": [real_step]}]
    )

    result = await answer_question(
        digest=digest,
        trace=trace,
        current_step=3,
        curriculum_chunks=[],
        history=[],
        question="why did mid change?",
        llm_client=llm_client,
    )

    assert result.answer == "mid landed there because..."
    assert result.step_refs == [real_step]
    assert not result.degraded
    assert len(llm_client.calls) == 1


async def test_empty_step_refs_on_a_code_question_triggers_one_retry_then_succeeds() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    real_step = trace["steps"][2]["i"]
    llm_client = FakeLLMClient(
        json_responses=[
            {"answer": "unsupported first answer", "step_refs": []},
            {"answer": "supported second answer", "step_refs": [real_step]},
        ]
    )

    result = await answer_question(
        digest=digest,
        trace=trace,
        current_step=2,
        curriculum_chunks=[],
        history=[],
        question="what happened to my array here?",
        llm_client=llm_client,
    )

    assert result.answer == "supported second answer"
    assert result.step_refs == [real_step]
    assert not result.degraded
    assert len(llm_client.calls) == 2


async def test_two_failed_attempts_degrade_to_the_safe_fallback() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    llm_client = FakeLLMClient(
        json_responses=[
            {"answer": "a", "step_refs": []},
            {"answer": "b", "step_refs": []},
        ]
    )

    result = await answer_question(
        digest=digest,
        trace=trace,
        current_step=2,
        curriculum_chunks=[],
        history=[],
        question="why did my code do this?",
        llm_client=llm_client,
    )

    assert result.answer == FALLBACK_ANSWER
    assert result.step_refs == []
    assert result.degraded
    assert len(llm_client.calls) == 2


async def test_a_general_concept_question_is_allowed_zero_step_refs() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    llm_client = FakeLLMClient(
        json_responses=[{"answer": "Big-O describes growth rate.", "step_refs": []}]
    )

    result = await answer_question(
        digest=digest,
        trace=trace,
        current_step=0,
        curriculum_chunks=[],
        history=[],
        question="What is Big-O notation?",
        llm_client=llm_client,
    )

    assert result.answer == "Big-O describes growth rate."
    assert result.step_refs == []
    assert not result.degraded
    assert len(llm_client.calls) == 1


async def test_hallucinated_step_index_is_rejected_like_an_empty_one() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    real_step = trace["steps"][1]["i"]
    llm_client = FakeLLMClient(
        json_responses=[
            {"answer": "a", "step_refs": [999_999_999]},
            {"answer": "b", "step_refs": [real_step]},
        ]
    )

    result = await answer_question(
        digest=digest,
        trace=trace,
        current_step=1,
        curriculum_chunks=[ConceptChunk(id="x", concept_id="binary-search", content="...")],
        history=[],
        question="explain this step",
        llm_client=llm_client,
    )

    assert result.step_refs == [real_step]
    assert len(llm_client.calls) == 2
