#!/usr/bin/env python3
"""Generates the twelve golden fixtures in fixtures/*.trace.json by running
real programs (fixtures/generator/programs/*.py) under the throwaway
sys.monitoring tracer in tracer.py, then validates every output against
trace.schema.json before writing it. Throwaway: not part of the product,
not imported by apps/api or services/executor. See fixtures/README.md.

Usage: uv run --package oocc-fixtures-generator python fixtures/generator/run_all.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

GENERATOR_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = GENERATOR_DIR.parent
PROGRAMS_DIR = GENERATOR_DIR / "programs"

sys.path.insert(0, str(GENERATOR_DIR))
sys.path.insert(0, str(FIXTURES_DIR.parent / "packages" / "contracts" / "python" / "src"))

import oocc_contracts as contracts  # noqa: E402
from tracer import Tracer  # noqa: E402

TARGET_LARGE_TRACE_STEPS = 40_000

FIXTURES = [
    {"name": "bubble_sort", "file": "bubble_sort.py", "expect_status": "ok"},
    {
        "name": "binary_search",
        "file": "binary_search.py",
        "stdin": "1 3 5 7 9 11 13 15 17 19\n13\n",
        "expect_status": "ok",
    },
    {"name": "fibonacci_recursion", "file": "fibonacci_recursion.py", "expect_status": "ok"},
    {"name": "bfs_graph", "file": "bfs_graph.py", "expect_status": "ok"},
    {"name": "linked_list_reversal", "file": "linked_list_reversal.py", "expect_status": "ok"},
    {
        "name": "two_sum",
        "file": "two_sum.py",
        "stdin": "2 7 11 15 3\n9\n",
        "expect_status": "ok",
    },
    {"name": "quicksort_partition", "file": "quicksort_partition.py", "expect_status": "ok"},
    {"name": "dp_knapsack", "file": "dp_knapsack.py", "expect_status": "ok"},
    {
        "name": "infinite_loop",
        "file": "infinite_loop.py",
        "expect_status": "step_limit",
        "tracer_kwargs": {"step_limit": 600, "keep_head": 50, "keep_tail": 20},
    },
    {"name": "throws", "file": "throws.py", "expect_status": "runtime_error"},
    {
        "name": "n_queens",
        "file": "n_queens.py",
        "expect_status": "ok",
        # ~2.7k steps of real backtracking; pretty-printing ~triples the
        # file for no real review benefit at that size.
        "compact": True,
    },
    {
        "name": "large_trace_40k",
        "file": "large_trace_40k.py",
        "expect_status": "ok",
        "large_trace": True,
        "compact": True,
    },
]


_N_ASSIGNMENT = re.compile(r"^N = \d+", re.MULTILINE)


def with_n(template: str, n: int) -> str:
    source, count = _N_ASSIGNMENT.subn(f"N = {n}", template, count=1)
    assert count == 1, "large_trace_40k.py must start with a literal `N = <int>` line"
    return source


def calibrate_large_trace_n(template: str) -> int:
    """Find an N for which range(N) produces ~TARGET_LARGE_TRACE_STEPS steps.

    A simple accumulate-in-a-loop program's step count is affine in N (a
    fixed setup/teardown overhead plus ~2 steps per iteration: the `for`
    line and the body line). One calibration run gives the slope precisely
    enough to hit the target within a few iterations.
    """
    n = 5_000
    for _ in range(4):
        trace = Tracer().run(with_n(template, n))
        actual = trace["meta"]["step_count"]
        if abs(actual - TARGET_LARGE_TRACE_STEPS) / TARGET_LARGE_TRACE_STEPS < 0.02:
            return n
        n = max(1, round(n * (TARGET_LARGE_TRACE_STEPS / actual)))
    return n


def run_one(spec: dict) -> tuple[str, dict]:
    source = (PROGRAMS_DIR / spec["file"]).read_text()

    if spec.get("large_trace"):
        n = calibrate_large_trace_n(source)
        source = with_n(source, n)
        print(f"  calibrated N={n} for ~{TARGET_LARGE_TRACE_STEPS} steps")

    tracer_kwargs = spec.get("tracer_kwargs", {})
    trace = Tracer(**tracer_kwargs).run(source, stdin=spec.get("stdin", ""))

    expect_status = spec["expect_status"]
    if trace["status"] != expect_status:
        raise AssertionError(
            f"{spec['name']}: expected status={expect_status!r}, got {trace['status']!r}"
            + (f" error={trace.get('error')}" if "error" in trace else "")
        )
    if expect_status == "runtime_error" and "error" not in trace:
        raise AssertionError(
            f"{spec['name']}: status is runtime_error but no error object was populated"
        )
    if expect_status == "step_limit" and not trace["meta"]["truncated"]:
        raise AssertionError(f"{spec['name']}: status is step_limit but meta.truncated is not True")

    return spec["name"], trace


def main() -> None:
    FIXTURES_DIR.mkdir(exist_ok=True)
    summary = []

    for spec in FIXTURES:
        print(f"[{spec['name']}] running...")
        name, trace = run_one(spec)

        parsed = contracts.validate_trace(trace)  # raises ContractValidationError on any violation

        out_path = FIXTURES_DIR / f"{name}.trace.json"
        if spec.get("compact"):
            # Pretty-printing would ~triple these on-disk (thousands of
            # steps, nobody reads them top to bottom) for no real review
            # benefit; every other fixture stays indented for diffability.
            text = json.dumps(trace, separators=(",", ":"))
        else:
            text = json.dumps(trace, indent=2)
        out_path.write_text(text + "\n")

        step_count = len(parsed.steps)
        summary.append((name, trace["status"], step_count, out_path.stat().st_size))
        print(f"[{name}] OK -> {out_path.name} (status={trace['status']}, steps={step_count})")

    print("\n=== summary ===")
    for name, status, steps, size_bytes in summary:
        print(
            f"  {name:24s} status={status:14s} steps={steps:6d} size={size_bytes / 1024:8.1f} KiB"
        )


if __name__ == "__main__":
    main()
