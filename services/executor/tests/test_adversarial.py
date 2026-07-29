"""docs/PRD.md §5's adversarial suite, actually written — Phase 1 called
for this ("Write an adversarial test suite in Phase 1: fork bomb, while
True, 10 GB allocation, deep recursion, open('/etc/passwd'), socket
connect, os.system, unicode bomb, 1e9-element range. Each must fail safely
and produce a useful error to the user.") but it never existed in this
repo until this Phase 6 security review found the gap. See repo-root
SECURITY.md for the full writeup, including cases deliberately *not* run
at hostile scale in this shared dev sandbox (real 10GB allocation, a real
fork bomb) and why.

`os.system`/`socket.connect`/`open('/etc/passwd')`/subprocess-based fork
bombs are covered by test_sandbox_imports.py (they're all blocked at the
module/builtin level before they'd ever get a chance to run) — this file
covers the adversarial cases that aren't import-shaped: runaway loops,
deep recursion, huge ranges, and a scaled-down memory-growth probe.
"""

from __future__ import annotations

import time

from executor_app.tracer import Tracer


def test_infinite_loop_is_stopped_by_wall_clock_not_left_to_run_forever() -> None:
    start = time.monotonic()
    # step_limit deliberately far above what 0.5s of tracing this tight a
    # loop can reach (full per-step frame/heap snapshotting is the
    # dominant cost, not the loop body) — otherwise this test silently
    # exercises the *step*-count path instead of the wall-clock one it's
    # named for. Found for real during the pre-launch audit: the original
    # version of this test used the default `step_limit=100_000`, which a
    # loop this cheap reaches in ~0.3s, well under any wall-clock budget
    # worth testing — the test was passing for the wrong reason, and
    # "asserts status == step_limit" was quietly proving nothing about the
    # wall-clock path at all.
    tracer = Tracer(wall_clock_limit_s=0.5, step_limit=100_000_000, keep_head=1000, keep_tail=0)
    trace = tracer.run("i = 0\nwhile True:\n    i += 1\n")
    elapsed = time.monotonic() - start

    assert trace["status"] == "timeout"
    assert elapsed < 5.0  # bounded, not "ran until the test harness killed it"
    assert trace["meta"]["truncated"] is True


def test_deep_recursion_fails_safely_with_a_useful_error() -> None:
    source = "def f(n):\n    return f(n + 1)\nf(0)\n"
    trace = Tracer().run(source)

    assert trace["status"] == "runtime_error"
    assert trace["error"]["type"] == "RecursionError"
    # Useful, not a bare interpreter crash: a step index and (when available)
    # a source line are both present for the frontend to land the player on.
    assert isinstance(trace["error"]["step"], int)


def test_billion_element_range_is_bounded_by_the_step_limit_not_by_actually_finishing() -> None:
    # range(10**9) is O(1) to construct (lazy) — the danger is the loop body
    # actually executing all billion iterations. A tiny step_limit proves
    # the cap is what stops it, in well under a second, without needing to
    # let a real 1e9-iteration loop run to prove the same point slowly.
    trace = Tracer(step_limit=500, keep_head=500, keep_tail=0, wall_clock_limit_s=5.0).run(
        "total = 0\nfor i in range(1_000_000_000):\n    total += i\n"
    )

    assert trace["status"] == "step_limit"
    assert trace["meta"]["step_count"] <= 500


def test_unicode_bomb_stdout_is_truncated_not_unbounded() -> None:
    # A single expanding write, not "print in a loop" (already covered by
    # the stdout-cap fixture-generator tests) — proves the 256KB cap holds
    # even for one enormous single `print`, which a naive per-call-size
    # check could miss if it only looked at cumulative *count* of writes.
    tracer = Tracer(stdout_limit_bytes=256_000, keep_head=100, keep_tail=0, wall_clock_limit_s=5.0)
    trace = tracer.run("print('\\u2603' * 5_000_000)\n")

    total_stdout = sum(len(s.get("stdout_delta", "").encode("utf-8")) for s in trace["steps"])
    assert total_stdout < 300_000  # cap plus one marker step, not 5,000,000 snowman bytes


def test_memory_growth_is_not_currently_bounded_by_the_tracer_itself() -> None:
    """Documents a real, known gap rather than hiding it. `Tracer.run` now
    calls `resource.setrlimit(RLIMIT_AS, ...)` (docs/AUDIT.md Pass 2) — but
    that was directly tested against a real oversized allocation during the
    audit and confirmed **not reliably enforced on macOS** (the process's
    real memory kept growing past 3GB instead of raising `MemoryError`;
    had to be killed by hand). The actual, reliable enforcement PRD §3.3
    means is meant to come from the OS-level sandbox (gVisor/nsjail,
    `--memory 256m`), which doesn't exist yet in this deployment (see
    SECURITY.md). This test runs a *safe*, small (~8MB) allocation — one
    big string, not a million-item list (a list that size makes per-step
    heap *snapshotting* slow enough to hit the wall-clock limit first, a
    different, already-covered gap, and would stop this test before it
    demonstrated anything about memory at all) — and confirms it succeeds
    with `status: ok` rather than being stopped. This is deliberately not
    a test of whether the 256MB limit holds (see docs/AUDIT.md Pass 2 for
    exactly why that's dangerous to automate: it nearly exhausted this
    sandbox's own memory during manual verification) — only that a small,
    harmless allocation is never mistakenly blocked. Do not scale this up
    to "prove the point more convincingly" — see SECURITY.md for why 10GB
    was deliberately not attempted in this sandbox, and docs/AUDIT.md Pass
    2 for why a real enforcement test isn't automated here either.
    """
    trace = Tracer(keep_head=100, keep_tail=0, wall_clock_limit_s=5.0).run(
        "data = 'x' * 8_000_000\nprint(len(data))\n"
    )

    assert trace["status"] == "ok"
