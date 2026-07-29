"""digest — pure Python, no LLM (docs/PRD.md §4.1, §4.3). Compresses a step
trace (up to 100k steps) down to roughly 2KB of structured facts. No LLM in
this product ever sees a raw trace; every agent node downstream reasons
over this digest instead. That's what keeps the pipeline cheap, fast, and
checkable — see CLAUDE.md "Deterministic means deterministic".

The 2KB budget is a hard design constraint, not a suggestion, so every
sub-extractor here caps its own output: at most 8 tracked variables (the
same channel-count convention the frontend uses) with at most 40
downsampled samples each, reprs truncated to a small fixed width, at most
10 hot lines, at most 10 heap shape signatures. See
tests/agents/test_digest.py's size-ceiling assertion against
`large_trace_40k`.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from pydantic import BaseModel

from app.analysis.heap_graph import merge_heap_across_steps

MAX_TRACKED_VARIABLES = 8
MAX_SAMPLES_PER_VARIABLE = 40
MAX_REPR_LENGTH = 24
MAX_HOT_LINES = 10
MAX_HEAP_SIGNATURES = 10
MAX_LOOP_ENTRIES = 8
MAX_CALL_GRAPH_EDGES = 8
STDOUT_TAIL_CHARS = 200


class LoopSkeletonEntry(BaseModel):
    line_range: tuple[int, int]
    iterations: int
    vars_mutated: list[str]


class VariableHistory(BaseModel):
    name: str
    samples: list[str]


class CallGraphEdge(BaseModel):
    caller: str
    callee: str
    count: int


class Digest(BaseModel):
    status: str
    step_count: int
    loop_skeleton: list[LoopSkeletonEntry]
    variable_histories: list[VariableHistory]
    call_graph: list[CallGraphEdge]
    recursion_depth_histogram: dict[int, int]
    heap_shape_signatures: list[str]
    hot_lines: list[tuple[int, int]]
    terminal_state: str
    stdout_tail: str
    error: dict[str, Any] | None = None


def compute_digest(trace: dict[str, Any]) -> Digest:
    steps = trace.get("steps", [])
    return Digest(
        status=trace.get("status", "ok"),
        step_count=len(steps),
        loop_skeleton=_loop_skeleton(steps),
        variable_histories=_variable_histories(steps),
        call_graph=_call_graph(steps),
        recursion_depth_histogram=_recursion_depth_histogram(steps),
        heap_shape_signatures=_heap_shape_signatures(trace),
        hot_lines=_hot_lines(steps),
        terminal_state=trace.get("status", "ok"),
        stdout_tail=_stdout_tail(steps),
        error=_compact_error(trace.get("error")),
    )


def _repr_of(value: dict[str, Any] | None) -> str:
    if value is None:
        return "None"
    if isinstance(value, dict) and "val" in value:
        text = value.get("repr") or repr(value["val"])
    elif isinstance(value, dict) and "ref" in value:
        text = f"->{value['ref']}"
    else:
        text = repr(value)
    return text if len(text) <= MAX_REPR_LENGTH else text[: MAX_REPR_LENGTH - 1] + "…"


def _downsample(items: list[str], max_points: int) -> list[str]:
    if len(items) <= max_points:
        return items
    stride = len(items) / max_points
    return [items[int(i * stride)] for i in range(max_points)]


def _loop_skeleton(steps: list[dict[str, Any]]) -> list[LoopSkeletonEntry]:
    """A "line" step whose line is lower than the previous "line" step
    *in the same frame activation* is a backward branch — the loop-detection
    rule apps/web/lib/player/loops.ts uses on the frontend, re-derived here
    from the trace alone (no shared code between the two languages)."""
    frame_line_steps: dict[str, list[dict[str, Any]]] = {}
    for step in steps:
        stack = step.get("stack") or []
        if not stack or step.get("event") != "line":
            continue
        frame_line_steps.setdefault(stack[-1]["frame_id"], []).append(step)

    headers: dict[int, dict[str, Any]] = {}
    for frame_id, seq in frame_line_steps.items():
        prev_line: int | None = None
        for step in seq:
            line = step["line"]
            if prev_line is not None and line < prev_line:
                entry = headers.setdefault(line, {"iterations": 0, "max_line": line, "vars": set()})
                entry["iterations"] += 1
            candidate_headers = [h for h in headers if h <= line]
            if candidate_headers:
                entry = headers[max(candidate_headers)]
                entry["max_line"] = max(entry["max_line"], line)
                for path in step.get("changed", []):
                    if path.startswith(f"{frame_id}."):
                        entry["vars"].add(path.split(".", 1)[1])
            prev_line = line

    entries = [
        LoopSkeletonEntry(
            line_range=(header, data["max_line"]),
            iterations=data["iterations"],
            vars_mutated=sorted(data["vars"])[:4],
        )
        for header, data in sorted(headers.items())
    ]
    # Most-iterated loops first — those are the ones worth an LLM's or a
    # learner's attention; a backtracking program's dozens of tiny
    # single-iteration branches aren't.
    entries.sort(key=lambda e: e.iterations, reverse=True)
    return entries[:MAX_LOOP_ENTRIES]


def _variable_histories(steps: list[dict[str, Any]]) -> list[VariableHistory]:
    """The active (innermost) frame's locals only, first-appearance order,
    capped at MAX_TRACKED_VARIABLES — the same channel-budget convention
    the frontend's lib/player/channels.ts uses, for the same reason: a
    fixed, small ceiling keeps the digest's size independent of how many
    variables the program happens to declare."""
    order: list[str] = []
    raw: dict[str, list[str]] = {}
    for step in steps:
        stack = step.get("stack") or []
        if not stack:
            continue
        for name, value in stack[-1].get("locals", {}).items():
            if name not in raw:
                if len(order) >= MAX_TRACKED_VARIABLES:
                    continue
                order.append(name)
                raw[name] = []
            if name in raw:
                raw[name].append(_repr_of(value))

    return [
        VariableHistory(name=name, samples=_downsample(raw[name], MAX_SAMPLES_PER_VARIABLE))
        for name in order
    ]


def _call_graph(steps: list[dict[str, Any]]) -> list[CallGraphEdge]:
    edges: Counter[tuple[str, str]] = Counter()
    for step in steps:
        if step.get("event") != "call":
            continue
        stack = step.get("stack") or []
        if not stack:
            continue
        callee = stack[-1]["func"]
        caller = stack[-2]["func"] if len(stack) >= 2 else "<module>"
        edges[(caller, callee)] += 1
    return [
        CallGraphEdge(caller=c, callee=e, count=n)
        for (c, e), n in edges.most_common(MAX_CALL_GRAPH_EDGES)
    ]


def _recursion_depth_histogram(steps: list[dict[str, Any]]) -> dict[int, int]:
    counts: Counter[int] = Counter(step.get("depth", 0) for step in steps)
    return dict(sorted(counts.items()))


def _infer_elem_type(values: list[Any]) -> str:
    types: set[str] = set()
    for value in values:
        if value is None:
            continue
        if isinstance(value, dict) and "val" in value:
            if value["val"] is None:
                continue
            types.add(type(value["val"]).__name__)
        elif isinstance(value, dict) and "ref" in value:
            types.add("ref")
    if len(types) == 1:
        return next(iter(types))
    return "any" if types else "?"


def _heap_shape_signatures(trace: dict[str, Any]) -> list[str]:
    merged = merge_heap_across_steps(trace)
    signatures: list[str] = []
    seen: set[str] = set()
    for obj in merged.values():
        obj_type = obj.get("type")
        if obj_type == "list":
            sig = f"list<{_infer_elem_type(obj.get('items', []))}>[{obj.get('len', 0)}]"
        elif obj_type == "dict":
            entries = obj.get("entries", [])
            key_type = _infer_elem_type([e["key"] for e in entries])
            val_type = _infer_elem_type([e["value"] for e in entries])
            sig = f"dict<{key_type},{val_type}>"
        elif "fields" in obj:
            sig = f"{obj_type}{{{','.join(obj['fields'].keys())}}}"
        else:
            continue
        if sig not in seen:
            seen.add(sig)
            signatures.append(sig)
        if len(signatures) >= MAX_HEAP_SIGNATURES:
            break
    return signatures


def _hot_lines(steps: list[dict[str, Any]]) -> list[tuple[int, int]]:
    counts: Counter[int] = Counter(step["line"] for step in steps if "line" in step)
    return list(counts.most_common(MAX_HOT_LINES))


def _stdout_tail(steps: list[dict[str, Any]]) -> str:
    full = "".join(step.get("stdout_delta", "") for step in steps)
    return full[-STDOUT_TAIL_CHARS:]


def _compact_error(error: dict[str, Any] | None) -> dict[str, Any] | None:
    if not error:
        return None
    return {"type": error.get("type"), "message": error.get("message"), "line": error.get("line")}
