#!/usr/bin/env python3
"""insight_scanner eval suite (Phase 3 backend brief, item 6): twenty
programs with known, deliberately-planted bugs (see manifest.py). Asserts
the scanner finds the real fault in at least sixteen, and — the harder,
more important property — that no finding ever cites a step index absent
from the real trace (docs/PRD.md §1's "no claim without a real step
index", applied to insight_scanner specifically here).

Uses the real production tracer (services/executor/executor_app/tracer.py),
not the throwaway fixtures/generator one — this eval is exercising the
actual deterministic pipeline, not a stand-in for it.

Usage: uv run --package oocc-api python apps/api/evals/run_insight_scanner_eval.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

EVALS_DIR = Path(__file__).resolve().parent
PROGRAMS_DIR = EVALS_DIR / "programs"
API_DIR = EVALS_DIR.parent
EXECUTOR_DIR = API_DIR.parent.parent / "services" / "executor"

sys.path.insert(0, str(API_DIR))
sys.path.insert(0, str(EXECUTOR_DIR))
sys.path.insert(0, str(EVALS_DIR))

from app.analysis.insight_scanner import scan_insights  # noqa: E402
from executor_app.tracer import Tracer  # noqa: E402
from manifest import EVAL_CASES, EvalCase  # noqa: E402

PASS_THRESHOLD = 16


def run_case(case: EvalCase) -> tuple[bool, list[str], list[dict[str, Any]]]:
    source = (PROGRAMS_DIR / case.filename).read_text()
    tracer_kwargs = {"step_limit": case.step_limit} if case.step_limit else {}
    trace = Tracer(**tracer_kwargs).run(source)
    insights = scan_insights(trace, source)

    found_kinds = {insight["kind"] for insight in insights}
    passed = case.expected_kind in found_kinds

    valid_indices = {step["i"] for step in trace["steps"]}
    violations = [
        f"{case.filename}: {insight['kind']} cites step {step_ref}, not in the trace"
        for insight in insights
        for step_ref in insight["step_refs"]
        if step_ref not in valid_indices
    ]

    return passed, violations, insights


def main() -> int:
    results: list[tuple[EvalCase, bool, list[dict[str, Any]]]] = []
    all_violations: list[str] = []
    for case in EVAL_CASES:
        passed, violations, insights = run_case(case)
        results.append((case, passed, insights))
        all_violations.extend(violations)

    passed_count = sum(1 for _, passed, _ in results if passed)
    print(f"=== insight_scanner eval: {passed_count}/{len(results)} ===\n")
    for case, passed, insights in results:
        status = "PASS" if passed else "FAIL"
        found = sorted({insight["kind"] for insight in insights})
        print(f"[{status}] {case.filename:38s} expected={case.expected_kind:28s} found={found}")

    ok = True
    if passed_count < PASS_THRESHOLD:
        print(f"\nFAILED: only {passed_count}/{len(results)} passed, need >= {PASS_THRESHOLD}")
        ok = False
    if all_violations:
        print(f"\nFAILED: {len(all_violations)} step_refs cited an index absent from the trace:")
        for violation in all_violations:
            print(f"  - {violation}")
        ok = False

    if ok:
        print(f"\nOK: {passed_count}/{len(results)} >= {PASS_THRESHOLD}, all step_refs valid")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
