"""viz_planner — rules half (docs/PRD.md §4.3). Given structure_detector's
findings and the trace, emits the panel plan: which panels to mount and
what heap ref or frame path each one binds to. Output is validated against
the hardcoded panel registry (packages/contracts/viz-plan.schema.json) and
anything outside it is dropped — the LLM half (narration, and the
low-confidence structure fallback) is Phase 3's job; this module never
guesses, it only projects already-detected facts into a plan.

Plans are cached by source_hash (`sha256(source)`), matching PRD §4.4's
cache-key convention — the same source always produces the same plan, so a
returning user costs nothing to re-plan. Process-local and unbounded-TTL by
design for this phase; promoting it to the shared Redis cache alongside the
LLM-output cache is future infra work, not a behavior change.
"""

from __future__ import annotations

import hashlib
from collections import OrderedDict
from typing import Any

from oocc_contracts import validate_viz_plan

# Panel registry v1 (PRD §4.3) — the full set any panel `type` must belong
# to. structure_detector's StructureKind enum is already a subset of this,
# but we still filter explicitly: a defensive check against any future kind
# that gets added to one registry without the other.
PANEL_REGISTRY = frozenset(
    {
        "array",
        "array_2d",
        "linked_list",
        "binary_tree",
        "graph",
        "stack",
        "queue",
        "hash_map",
        "call_stack",
        "recursion_tree",
        "variables",
        "heap_objects",
        "console",
        "timeline",
    }
)

_CACHE_MAX_SIZE = 512
_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()


def source_hash(source: str) -> str:
    return f"sha256:{hashlib.sha256(source.encode()).hexdigest()}"


def plan_viz(
    source: str, structures: list[dict[str, Any]], trace: dict[str, Any]
) -> dict[str, Any]:
    key = source_hash(source)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    plan = _build_plan(structures, trace)
    validate_viz_plan(plan)

    _cache[key] = plan
    _cache.move_to_end(key)
    if len(_cache) > _CACHE_MAX_SIZE:
        _cache.popitem(last=False)
    return plan


def _build_plan(structures: list[dict[str, Any]], trace: dict[str, Any]) -> dict[str, Any]:
    panels: list[dict[str, Any]] = []
    next_id = _id_counter()

    for i, structure in enumerate(structures):
        kind = structure["kind"]
        if kind not in PANEL_REGISTRY:
            continue
        panels.append(
            {
                "id": next_id(),
                "type": kind,
                "binding": structure["root_ref"],
                "role": "primary" if i == 0 else "secondary",
            }
        )

    if _has_recursion(trace):
        panels.append({"id": next_id(), "type": "recursion_tree", "role": "secondary"})

    panels.append({"id": next_id(), "type": "call_stack", "role": "secondary"})
    panels.append({"id": next_id(), "type": "variables", "role": "secondary"})

    if _has_stdout(trace):
        panels.append({"id": next_id(), "type": "console", "role": "secondary"})

    layout = "primary+stack" if structures else "meta"
    return {"layout": layout, "panels": panels}


def _id_counter() -> Any:
    count = 0

    def _next() -> str:
        nonlocal count
        count += 1
        return f"p{count}"

    return _next


def _has_recursion(trace: dict[str, Any]) -> bool:
    for step in trace.get("steps", []):
        stack = step.get("stack") or []
        names = [frame["func"] for frame in stack]
        if len(names) != len(set(names)):
            return True
    return False


def _has_stdout(trace: dict[str, Any]) -> bool:
    return any(step.get("stdout_delta") for step in trace.get("steps", []))
