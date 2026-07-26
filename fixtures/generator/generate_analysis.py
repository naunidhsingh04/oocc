#!/usr/bin/env python3
"""Generates fixtures/*.analysis.json and fixtures/*.plan.json from the
already-committed fixtures/*.trace.json files, running them through the same
deterministic pipeline POST /api/runs calls at request time
(structure_detector, insight_scanner, complexity_analyst, viz_planner) — so
Person A can build panels against real analysis/plan shapes without a
running API + executor. Throwaway generator script, like run_all.py: not
part of the product, not imported by apps/api or services/executor.

Usage: uv run --package oocc-fixtures-generator python fixtures/generator/generate_analysis.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

GENERATOR_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = GENERATOR_DIR.parent
PROGRAMS_DIR = GENERATOR_DIR / "programs"
REPO_ROOT = FIXTURES_DIR.parent

sys.path.insert(0, str(REPO_ROOT / "packages" / "contracts" / "python" / "src"))
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))
sys.path.insert(0, str(REPO_ROOT / "services" / "executor"))

import oocc_contracts as contracts  # noqa: E402
from app.analysis.complexity_analyst import analyze_complexity  # noqa: E402
from app.analysis.insight_scanner import scan_insights  # noqa: E402
from app.analysis.structure_detector import detect_structures  # noqa: E402
from app.analysis.viz_planner import plan_viz  # noqa: E402
from executor_app.tracer import CounterTracer  # noqa: E402


class InProcessCounterExecutor:
    """Implements just the slice of app.executor_client.ExecutorClient's
    interface complexity_analyst needs, calling the tracer directly. This
    script has no running executor service to talk HTTP to; production code
    always goes over the network (see app/executor_client.py)."""

    async def execute_counters(self, source: str, *, stdin: str = "") -> dict[str, Any]:
        return CounterTracer().run(source, stdin=stdin)


FIXTURE_NAMES = [
    "bubble_sort",
    "binary_search",
    "fibonacci_recursion",
    "bfs_graph",
    "linked_list_reversal",
    "two_sum",
    "quicksort_partition",
    "dp_knapsack",
    "infinite_loop",
    "throws",
    "n_queens",
    "large_trace_40k",
]


async def generate_one(name: str, executor: InProcessCounterExecutor) -> None:
    trace = json.loads((FIXTURES_DIR / f"{name}.trace.json").read_text())
    source = (PROGRAMS_DIR / f"{name}.py").read_text()

    structures = detect_structures(trace)
    insights = scan_insights(trace, source)
    complexity = await analyze_complexity(source, executor)  # type: ignore[arg-type]

    analysis = {"structures": structures, "insights": insights, "complexity": complexity}
    contracts.validate_analysis(analysis)
    (FIXTURES_DIR / f"{name}.analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")

    plan = plan_viz(source, structures, trace)
    (FIXTURES_DIR / f"{name}.plan.json").write_text(json.dumps(plan, indent=2) + "\n")

    print(
        f"[{name}] structures={len(structures)} insights={len(insights)} "
        f"complexity={'yes' if complexity else 'no'} panels={len(plan['panels'])}"
    )


async def main() -> None:
    executor = InProcessCounterExecutor()
    for name in FIXTURE_NAMES:
        await generate_one(name, executor)


if __name__ == "__main__":
    asyncio.run(main())
