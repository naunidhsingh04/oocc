"""Runs the same twenty-program eval suite as a regular (fast, fully
deterministic) test, so a regression is caught on every push, not only in
the nightly workflow (.github/workflows/nightly-evals.yml) that runs
evals/run_insight_scanner_eval.py directly for its human-readable report.
"""

import sys
from pathlib import Path

EVALS_DIR = Path(__file__).resolve().parents[2] / "evals"
if str(EVALS_DIR) not in sys.path:
    sys.path.insert(0, str(EVALS_DIR))

from manifest import EVAL_CASES  # noqa: E402
from run_insight_scanner_eval import PASS_THRESHOLD, run_case  # noqa: E402


def test_insight_scanner_finds_the_real_fault_in_at_least_sixteen_of_twenty() -> None:
    passed_count = 0
    failures = []
    for case in EVAL_CASES:
        passed, _violations, insights = run_case(case)
        if passed:
            passed_count += 1
        else:
            found = sorted({insight["kind"] for insight in insights})
            failures.append(f"{case.filename}: expected {case.expected_kind}, found {found}")

    assert passed_count >= PASS_THRESHOLD, (
        f"only {passed_count}/{len(EVAL_CASES)} passed (need >= {PASS_THRESHOLD}):\n"
        + "\n".join(failures)
    )


def test_no_insight_ever_cites_a_step_index_absent_from_its_trace() -> None:
    all_violations: list[str] = []
    for case in EVAL_CASES:
        _passed, violations, _insights = run_case(case)
        all_violations.extend(violations)

    assert not all_violations, "\n".join(all_violations)
