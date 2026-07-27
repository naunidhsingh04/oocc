"""insight_scanner — the seven deterministic detectors from docs/PRD.md
§4.3's table. Each returns structured findings only (kind, severity,
step_refs, an optional factual `detail`) — narration is Phase 3's job, an
LLM call over these *already-detected* facts, never a detector itself.

Several detectors need both the trace (what actually happened) and the
source (what the code says) — e.g. shadowed_builtin and dead_variable are
purely static, while runaway_loop and redundant_recomputation are purely
trace-based, and accidental_quadratic is both.
"""

from __future__ import annotations

import ast
import builtins as builtins_module
from typing import Any

from app.analysis.heap_graph import (
    heap_object_length_history,
    item_key,
    merge_heap_across_steps,
    value_ref,
)

BUILTIN_NAMES = frozenset(dir(builtins_module))
RUNAWAY_LOOP_MIN_STEPS = 500


def scan_insights(trace: dict[str, Any], source: str) -> list[dict]:
    insights: list[dict] = []
    insights += _detect_runaway_loop(trace)
    insights += _detect_off_by_one(trace)
    insights += _detect_mutation_during_iteration(trace, source)
    insights += _detect_accidental_quadratic(trace, source)
    insights += _detect_shadowed_builtin(trace, source)
    insights += _detect_dead_variable(trace, source)
    insights += _detect_redundant_recomputation(trace)
    return insights


# -- runaway / infinite loop -----------------------------------------------


def _detect_runaway_loop(trace: dict[str, Any]) -> list[dict]:
    # Hitting the tracer's own step/wall-clock cap (see CounterTracer /
    # Tracer's step_limit) is itself the evidence: a loop that never
    # terminates within a generous budget IS a runaway loop, whether its
    # locals are visibly stuck (e.g. an off-by-one that never reaches its
    # bound) or still incrementing forever (e.g. `while True: i += 1`, which
    # has no stuck local to point at but is exactly as much of a bug).
    if trace.get("status") != "step_limit":
        return []
    steps = trace.get("steps", [])
    if len(steps) < 2:
        return []

    # Best-effort extra signal: any local (frame_id.name) whose *value*
    # never changes across the trailing window, even though its step (line)
    # keeps recurring. Purely additive detail — its absence doesn't mean
    # the loop isn't runaway.
    window = steps[-RUNAWAY_LOOP_MIN_STEPS:] if len(steps) > RUNAWAY_LOOP_MIN_STEPS else steps
    last_value: dict[str, str] = {}
    seen_count: dict[str, int] = {}
    stuck: dict[str, int] = {}  # path -> streak length

    for step in window:
        for frame in step.get("stack", []):
            fid = frame["frame_id"]
            for name, value in frame.get("locals", {}).items():
                path = f"{fid}.{name}"
                seen_count[path] = seen_count.get(path, 0) + 1
                rep = repr(value)
                if path in last_value and last_value[path] == rep:
                    stuck[path] = stuck.get(path, 0) + 1
                last_value[path] = rep

    stuck_paths = sorted(
        p for p, streak in stuck.items() if seen_count[p] >= 2 and streak >= seen_count[p] - 1
    )
    step_refs = [window[0]["i"], window[-1]["i"]]
    if stuck_paths:
        detail = f"stuck: {', '.join(stuck_paths[:5])}"
    else:
        detail = "step/time limit reached without terminating"
    return [{"kind": "runaway_loop", "severity": "error", "step_refs": step_refs, "detail": detail}]


# -- off-by-one --------------------------------------------------------------


def _detect_off_by_one(trace: dict[str, Any]) -> list[dict]:
    error = trace.get("error")
    if not error or error.get("type") not in ("IndexError", "KeyError"):
        return []
    step = error.get("step")
    if step is None:
        return []
    return [
        {
            "kind": "off_by_one",
            "severity": "error",
            "step_refs": [step],
            "detail": f"{error['type']}: {error.get('message', '')}",
        }
    ]


# -- mutation during iteration -----------------------------------------------


def _detect_mutation_during_iteration(trace: dict[str, Any], source: str) -> list[dict]:
    """Only `for x in container:` (direct iteration) is the risky pattern
    PRD §4.3 means — mutating the sequence you're walking element-by-element
    can skip or repeat items. `for i in range(len(container)): container[i]`
    is the normal shape of every in-place algorithm (bubble sort, partition
    schemes, ...) and must not be flagged just because it both reads and
    writes the same container inside a loop.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    loops: list[tuple[int, int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.For) and isinstance(node.iter, ast.Name):
            end_line = max(
                (getattr(n, "lineno", node.lineno) for n in ast.walk(node)), default=node.lineno
            )
            loops.append((node.lineno, end_line, node.iter.id))
    if not loops:
        return []

    findings: list[dict] = []
    reported: set[tuple[str, str]] = set()

    for step in trace.get("steps", []):
        line = step.get("line")
        stack = step.get("stack") or []
        if not stack:
            continue
        top = stack[-1]
        for start, end, var_name in loops:
            if not (start <= line <= end):
                continue
            oid = next(
                (
                    value_ref(frame["locals"][var_name])
                    for frame in reversed(stack)
                    if var_name in frame.get("locals", {})
                ),
                None,
            )
            if oid is None:
                continue
            key = (top["frame_id"], oid)
            if key in reported:
                continue
            for path in step.get("changed", []):
                changed_oid = path.split("[", 1)[0].split(".", 1)[0].split("{", 1)[0]
                if changed_oid == oid:
                    reported.add(key)
                    findings.append(
                        {
                            "kind": "mutation_during_iteration",
                            "severity": "warning",
                            "step_refs": [step["i"]],
                            "detail": (
                                f"{oid} (`{var_name}`) mutated while frame "
                                f"{top['frame_id']} directly iterates it"
                            ),
                        }
                    )
                    break
    return findings


# -- accidental O(n^2) --------------------------------------------------------


def _detect_accidental_quadratic(trace: dict[str, Any], source: str) -> list[dict]:
    findings: list[dict] = []

    # Trace signal: a list grown via front-insertion (list.insert(0, x) or
    # equivalent) — same shape as structure_detector's queue-front-growth,
    # examined here purely for the O(n) shift-per-insert cost it implies.
    merged_heap = merge_heap_across_steps(trace)
    for oid, obj in merged_heap.items():
        if obj.get("type") not in ("list",):
            continue
        history = heap_object_length_history(trace, oid)
        prev_keys: list[str] | None = None
        for step_i, items in history:
            keys = [item_key(v) for v in items]
            # A transition into/out of the empty list is positionally
            # ambiguous (see structure_detector._classify_access_pattern's
            # identical guard) — a plain append onto an empty list would
            # otherwise spuriously match "grew at index 0".
            if prev_keys is not None and (len(prev_keys) == 0 or len(keys) == 0):
                prev_keys = keys
                continue
            if prev_keys is not None and len(keys) == len(prev_keys) + 1 and keys[1:] == prev_keys:
                findings.append(
                    {
                        "kind": "accidental_quadratic",
                        "severity": "warning",
                        "step_refs": [step_i],
                        "detail": f"{oid} grew by insertion at index 0 (O(n) shift per insert)",
                    }
                )
                break
            prev_keys = keys

    # Source signal: `x in <name>` or `.insert(0, ...)` textually inside a
    # loop. Static and name-order stable, so a program that has this pattern
    # gets exactly one finding regardless of how many steps it ran for.
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return findings

    set_valued_names = _find_set_valued_names(tree)
    for loop in ast.walk(tree):
        if not isinstance(loop, (ast.For, ast.While)):
            continue
        for node in ast.walk(loop):
            if (
                isinstance(node, ast.Compare)
                # `not in` is at least as common a membership-check/dedup
                # pattern as plain `in` (e.g. `if v not in seen:`) and has
                # the identical O(n)-per-check cost on a list — both count.
                and any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops)
                and getattr(node, "lineno", None) is not None
                and not _compares_against_a_set(node, set_valued_names)
            ):
                finding = _static_quadratic_finding(
                    trace, node.lineno, "`in`/`not in` on a container inside a loop"
                )
                if finding is not None:
                    findings.append(finding)
            elif (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "insert"
                and node.args
                and isinstance(node.args[0], ast.Constant)
                and node.args[0].value == 0
            ):
                finding = _static_quadratic_finding(
                    trace, node.lineno, "list.insert(0, ...) inside a loop"
                )
                if finding is not None:
                    findings.append(finding)
    return findings


def _find_set_valued_names(tree: ast.AST) -> set[str]:
    """Names ever assigned a set literal/comprehension or `set(...)` call,
    module-wide (not scope-aware — a cheap over-approximation, and the
    right direction to err: skipping a real list-membership bug is better
    than flagging legitimate O(1) set membership, e.g. bfs_graph's
    `visited = {start}` then `if neighbor not in visited:`)."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        value = node.value
        is_set_call = (
            isinstance(value, ast.Call)
            and isinstance(value.func, ast.Name)
            and value.func.id == "set"
        )
        is_set_valued = isinstance(value, (ast.Set, ast.SetComp)) or is_set_call
        if not is_set_valued:
            continue
        for target in node.targets:
            if isinstance(target, ast.Name):
                names.add(target.id)
    return names


def _compares_against_a_set(node: ast.Compare, set_valued_names: set[str]) -> bool:
    comparator = node.comparators[-1] if node.comparators else None
    return isinstance(comparator, ast.Name) and comparator.id in set_valued_names


def _static_quadratic_finding(trace: dict[str, Any], lineno: int, detail: str) -> dict | None:
    step_refs = [s["i"] for s in trace.get("steps", []) if s.get("line") == lineno]
    if not step_refs:
        return None
    return {
        "kind": "accidental_quadratic",
        "severity": "warning",
        "step_refs": step_refs[:10],
        "detail": detail,
    }


# -- shadowed builtin ----------------------------------------------------------


def _detect_shadowed_builtin(trace: dict[str, Any], source: str) -> list[dict]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    shadowed_lines: dict[str, int] = {}
    for node in ast.walk(tree):
        name = None
        lineno = getattr(node, "lineno", None)
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in BUILTIN_NAMES:
                    name = target.id
        elif isinstance(node, ast.arg) and node.arg in BUILTIN_NAMES:
            name = node.arg
        elif (
            isinstance(node, ast.For)
            and isinstance(node.target, ast.Name)
            and node.target.id in BUILTIN_NAMES
        ):
            name = node.target.id
        if name and lineno is not None and name not in shadowed_lines:
            shadowed_lines[name] = lineno

    findings = []
    for name, lineno in shadowed_lines.items():
        step_refs = [s["i"] for s in trace.get("steps", []) if s.get("line") == lineno]
        if not step_refs:
            continue
        findings.append(
            {
                "kind": "shadowed_builtin",
                "severity": "info",
                "step_refs": step_refs[:5],
                "detail": f"local `{name}` shadows the builtin `{name}`",
            }
        )
    return findings


# -- dead variable -------------------------------------------------------------


def _detect_dead_variable(trace: dict[str, Any], source: str) -> list[dict]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    findings = []
    for fn in ast.walk(tree):
        if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        stmts = list(ast.walk(fn))
        assigns: list[tuple[str, int]] = []
        for node in fn.body:
            for inner in ast.walk(node):
                if isinstance(inner, ast.Assign):
                    for target in inner.targets:
                        if isinstance(target, ast.Name):
                            assigns.append((target.id, node.lineno))

        for name, lineno in assigns:
            reads_after = any(
                isinstance(n, ast.Name)
                and n.id == name
                and isinstance(n.ctx, ast.Load)
                and getattr(n, "lineno", 0) > lineno
                for n in stmts
            )
            if not reads_after:
                step_refs = [s["i"] for s in trace.get("steps", []) if s.get("line") == lineno]
                if step_refs:
                    findings.append(
                        {
                            "kind": "dead_variable",
                            "severity": "info",
                            "step_refs": step_refs[:3],
                            "detail": (
                                f"`{name}` assigned in {fn.name}, "
                                "never read again before it goes out of scope"
                            ),
                        }
                    )
    return findings


# -- redundant recomputation ----------------------------------------------------


def _detect_redundant_recomputation(trace: dict[str, Any]) -> list[dict]:
    signatures: dict[tuple[str, tuple[str, ...]], list[int]] = {}
    for step in trace.get("steps", []):
        if step.get("event") != "call" or not step.get("stack"):
            continue
        top = step["stack"][-1]
        args = top.get("args") or []
        arg_repr = tuple(repr(top.get("locals", {}).get(a)) for a in args)
        signatures.setdefault((top["func"], arg_repr), []).append(step["i"])

    findings = []
    for (func, _args), step_refs in signatures.items():
        if len(step_refs) >= 2:
            findings.append(
                {
                    "kind": "redundant_recomputation",
                    "severity": "warning",
                    "step_refs": step_refs[:10],
                    "detail": f"{func} called with identical arguments {len(step_refs)} times",
                }
            )
    return findings
