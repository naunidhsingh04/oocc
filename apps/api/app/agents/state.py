"""The LangGraph pipeline's shared state (docs/PRD.md §4.2). Each parallel
analyzer node (structure_detector, insight_scanner, complexity_analyst,
algorithm_classifier) writes to its own dedicated key, so no reducer is
needed for the fan-out/fan-in — LangGraph's default last-write-wins merge
is exactly right when every writer owns a disjoint key.

Not JSON-serializable end to end (`executor`/`llm_client` are live client
objects) — this pipeline is invoked in-process per request with no
checkpointer, never persisted, so that's fine. If a checkpointer is ever
added, those two fields must move to `context_schema` instead of `state`.
"""

from __future__ import annotations

from typing import Any, TypedDict

from app.agents.complexity_narrator import ComplexityNarration
from app.agents.digest import Digest
from app.agents.llm_client import LLMClient
from app.executor_client import ExecutorClient


class PipelineState(TypedDict, total=False):
    # Inputs
    trace: dict[str, Any]
    source: str
    executor: ExecutorClient
    llm_client: LLMClient | None  # None => no provider key; deterministic-only run

    # digest
    digest: Digest

    # parallel analyzers
    structures: list[dict[str, Any]]
    insights: list[dict[str, Any]]
    insight_narrations: list[str | None]  # parallel to `insights`, see insight_narrator.py
    complexity: dict[str, Any] | None
    complexity_narration: ComplexityNarration | None
    algorithm: dict[str, Any] | None

    # convergent
    plan: dict[str, Any]
    plan_summary: str | None
    narration: list[dict[str, Any]]
