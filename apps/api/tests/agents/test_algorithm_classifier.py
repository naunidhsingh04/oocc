"""algorithm_classifier: structured output, thinking_budget 0, and the
retry-once-on-invalid-evidence_steps rule (docs/PRD.md §4.3)."""

import json
from pathlib import Path

import pytest
from app.agents.algorithm_classifier import classify_algorithm
from app.agents.digest import compute_digest
from app.agents.llm_client import FakeLLMClient

pytestmark = pytest.mark.anyio

FIXTURES_DIR = Path(__file__).resolve().parents[4] / "fixtures"


def _trace(name: str) -> dict:
    return json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())


async def test_no_key_present_returns_none_without_calling_the_model() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    result = await classify_algorithm(digest=digest, source="x = 1", trace=trace, llm_client=None)
    assert result is None


async def test_valid_evidence_steps_are_accepted_on_the_first_try() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    real_step = trace["steps"][3]["i"]
    llm_client = FakeLLMClient(
        json_responses=[
            {
                "algorithm": "binary search",
                "family": "searching",
                "confidence": 0.95,
                "evidence_steps": [real_step],
            }
        ]
    )

    result = await classify_algorithm(
        digest=digest, source="x = 1", trace=trace, llm_client=llm_client
    )

    assert result == {
        "algorithm": "binary search",
        "family": "searching",
        "confidence": 0.95,
        "evidence_steps": [real_step],
    }
    assert len(llm_client.calls) == 1


async def test_hallucinated_evidence_steps_trigger_exactly_one_retry_then_succeed() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    real_step = trace["steps"][2]["i"]
    fake_step_index = 10_000_000  # far beyond any real trace
    llm_client = FakeLLMClient(
        json_responses=[
            {
                "algorithm": "binary search",
                "family": "searching",
                "confidence": 0.9,
                "evidence_steps": [fake_step_index],
            },
            {
                "algorithm": "binary search",
                "family": "searching",
                "confidence": 0.9,
                "evidence_steps": [real_step],
            },
        ]
    )

    result = await classify_algorithm(
        digest=digest, source="x = 1", trace=trace, llm_client=llm_client
    )

    assert result is not None
    assert result["evidence_steps"] == [real_step]
    assert len(llm_client.calls) == 2
    # The retry's system prompt is a strengthened instruction, not identical.
    assert llm_client.calls[1]["system"] != llm_client.calls[0]["system"]


async def test_two_hallucinated_attempts_degrade_to_none_never_shipping_a_fake_index() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    fake_step_index = 10_000_000
    llm_client = FakeLLMClient(
        json_responses=[
            {
                "algorithm": "x",
                "family": "y",
                "confidence": 0.9,
                "evidence_steps": [fake_step_index],
            },
            {
                "algorithm": "x",
                "family": "y",
                "confidence": 0.9,
                "evidence_steps": [fake_step_index],
            },
        ]
    )

    result = await classify_algorithm(
        digest=digest, source="x = 1", trace=trace, llm_client=llm_client
    )

    assert result is None
    assert len(llm_client.calls) == 2


async def test_empty_evidence_steps_is_also_rejected() -> None:
    trace = _trace("binary_search")
    digest = compute_digest(trace)
    llm_client = FakeLLMClient(
        json_responses=[
            {"algorithm": "x", "family": "y", "confidence": 0.9, "evidence_steps": []},
            {"algorithm": "x", "family": "y", "confidence": 0.9, "evidence_steps": []},
        ]
    )

    result = await classify_algorithm(
        digest=digest, source="x = 1", trace=trace, llm_client=llm_client
    )
    assert result is None
