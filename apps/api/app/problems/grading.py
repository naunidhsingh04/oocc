"""Grades a learner's submission against a problem's `tests` by running it
through services/executor (docs/PRD.md §5: user code — however small —
only ever runs in the sandboxed executor, never in-process here), via the
same `ExecutorClient` every other run in this app uses.

The reference-solution verification in
tests/problems/test_reference_solutions.py is the one deliberate exception
to that rule: those are 40 programs *we* authored and check into the repo,
not something a learner submitted, so `exec`-ing them in-process at CI
time (no sandbox needed, nothing hostile) is fine. Anything that reaches
`grade_submission` at request time is someone else's code, and it goes
through the executor exactly like `POST /api/runs` does.

Test shape: each element of `tests` is `{"args": [...], "expected": <json>}`.
The harness embeds `args` as a Python literal (via `repr`) so there's no
string-escaping edge case between "what the test data looks like" and
"what the executed program sees" — it's just Python source calling
`solve(*args)` once per test case.

The harness deliberately never imports `json` inside the traced program:
docs/PRD.md §5's sandbox allowlist is `math, random, collections, heapq,
bisect, itertools, functools, string, typing, dataclasses, re` — `json` is
not on it, and empirically `import json` under this tracer raises a
`RecursionError` a couple of steps in (the tracer's per-line instrumentation
interacts badly with the C-accelerated encoder). Each result line is
printed as a plain Python tuple literal instead (`print(('OK', result))` /
`print(('ERR', message))`) — every type these 40 problems return (int,
float, str, bool, None, list, tuple) has a `repr()` that's also valid
Python source, so `ast.literal_eval` on the grading side reads it back
with no code execution and no extra sandbox permissions required.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any

from app.executor_client import ExecutorClient


@dataclass(frozen=True)
class TestOutcome:
    passed: bool
    expected: Any
    actual: Any | None
    error: str | None


@dataclass(frozen=True)
class GradeResult:
    passed: bool
    outcomes: list[TestOutcome]
    run_status: str


def _harness_source(source: str, tests: list[dict[str, Any]]) -> str:
    cases_literal = repr([test["args"] for test in tests])
    return (
        source.rstrip()
        + "\n\n"
        + f"_oocc_cases = {cases_literal}\n"
        + "for _oocc_args in _oocc_cases:\n"
        + "    try:\n"
        + "        _oocc_result = solve(*_oocc_args)\n"
        + "        print(('OK', _oocc_result))\n"
        + "    except Exception as _oocc_exc:\n"
        + "        print(('ERR', str(_oocc_exc)))\n"
    )


def _reconstruct_stdout(trace: dict[str, Any]) -> str:
    """The trace contract (docs/PRD.md §3.2) has no single "full stdout"
    field — stdout arrives as `stdout_delta` on individual `event:
    "stdout"` steps — so grading reassembles it the same way a terminal
    panel would."""
    return "".join(step.get("stdout_delta", "") for step in trace.get("steps", []))


def _normalize(value: Any) -> Any:
    """Recursively turns tuples into lists so e.g. a submission returning
    `(1, 2, 3)` compares equal to a test's list-shaped `expected` — the
    same normalization `json.dumps`/`json.loads` would have given for
    free, done by hand here since the harness no longer goes through
    `json` at all (see module docstring)."""
    if isinstance(value, (list, tuple)):
        return [_normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    return value


async def grade_submission(
    *, source: str, tests: list[dict[str, Any]], executor: ExecutorClient
) -> GradeResult:
    harness = _harness_source(source, tests)
    trace = await executor.execute(harness)

    if trace.get("status") not in ("ok", "step_limit"):
        # Compile error, timeout, crash before printing anything useful:
        # every test fails, but we still report *why* via run_status
        # rather than a generic "0/8 passed".
        outcomes = [
            TestOutcome(
                passed=False, expected=test["expected"], actual=None, error=trace.get("status")
            )
            for test in tests
        ]
        return GradeResult(passed=False, outcomes=outcomes, run_status=trace["status"])

    lines = [line for line in _reconstruct_stdout(trace).splitlines() if line.strip()]

    outcomes = []
    for i, test in enumerate(tests):
        expected = _normalize(test["expected"])
        if i >= len(lines):
            outcomes.append(
                TestOutcome(passed=False, expected=expected, actual=None, error="no_output")
            )
            continue
        try:
            tag, payload = ast.literal_eval(lines[i])
        except (ValueError, SyntaxError):
            outcomes.append(
                TestOutcome(
                    passed=False, expected=expected, actual=None, error="unparseable_output"
                )
            )
            continue
        if tag != "OK":
            outcomes.append(
                TestOutcome(passed=False, expected=expected, actual=None, error=str(payload))
            )
            continue
        actual = _normalize(payload)
        outcomes.append(
            TestOutcome(passed=actual == expected, expected=expected, actual=actual, error=None)
        )

    return GradeResult(
        passed=all(o.passed for o in outcomes), outcomes=outcomes, run_status=trace["status"]
    )
