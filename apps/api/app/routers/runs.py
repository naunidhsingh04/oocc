"""POST /api/runs — docs/PRD.md §4.2's deterministic half of the pipeline
(structure_detector, insight_scanner, complexity_analyst, viz_planner), run
against the executor and returned alongside the trace. No LLM call lives on
this path; algorithm_classifier, narration, and the tutor are Phase 3's job
and read this same trace + analysis, they don't replace it.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from oocc_contracts import validate_analysis
from pydantic import BaseModel

from app.analysis.complexity_analyst import analyze_complexity
from app.analysis.insight_scanner import scan_insights
from app.analysis.structure_detector import detect_structures
from app.analysis.viz_planner import plan_viz
from app.executor_client import ExecutorClient

router = APIRouter()


class RunRequest(BaseModel):
    source: str
    stdin: str = ""


def get_executor_client() -> ExecutorClient:
    return ExecutorClient()


@router.post("/api/runs")
async def create_run(
    request: RunRequest,
    executor: ExecutorClient = Depends(get_executor_client),
) -> dict[str, Any]:
    trace = await executor.execute(request.source, stdin=request.stdin)

    structures = detect_structures(trace)
    insights = scan_insights(trace, request.source)
    complexity = await analyze_complexity(request.source, executor)

    analysis = {"structures": structures, "insights": insights, "complexity": complexity}
    validate_analysis(analysis)

    plan = plan_viz(request.source, structures, trace)

    return {"trace": trace, "analysis": analysis, "plan": plan}
