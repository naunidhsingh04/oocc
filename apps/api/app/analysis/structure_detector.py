"""structure_detector — deterministic rule pass over heap shape and access
pattern (docs/PRD.md §4.3). Classifies by SHAPE, never by variable or class
name: a `class N: self.l=None; self.r=None` comes out as a binary tree
exactly like one named `TreeNode` with `left`/`right`. No LLM call lives
here or ever will — see CLAUDE.md "Deterministic means deterministic". The
Phase 3 LLM fallback for low-confidence cases plugs in downstream of
`detect_structures`, keyed off entries with confidence below some threshold
— nothing here needs to change to support that.
"""

from __future__ import annotations

from typing import Any

from app.analysis.heap_graph import (
    BUILTIN_HEAP_TYPES,
    heap_object_length_history,
    is_none_value,
    item_key,
    merge_heap_across_steps,
    value_ref,
)

CONFIDENCE = {
    "binary_tree": 0.95,
    "linked_list": 0.9,
    "graph": 0.85,
    "stack": 0.85,
    "queue": 0.85,
    "array_2d": 0.8,
    "hash_map": 0.7,
    "array": 0.6,
}


def detect_structures(trace: dict[str, Any]) -> list[dict[str, Any]]:
    merged_heap = merge_heap_across_steps(trace)
    findings: list[dict[str, Any]] = []
    consumed: set[str] = set()  # oids already accounted for by another structure

    findings += _detect_linked_structures(merged_heap, consumed)
    findings += _detect_dict_structures(merged_heap, consumed)
    findings += _detect_list_structures(trace, merged_heap, consumed)

    return findings


# -- instance graphs: linked_list / binary_tree --------------------------------


def _detect_linked_structures(
    merged_heap: dict[str, dict[str, Any]], consumed: set[str]
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    by_type = _group_instances_by_type(merged_heap)

    for oids in by_type.values():
        fields = _pointer_fields(oids, merged_heap)
        if not fields:
            continue

        graph = _build_pointer_graph(oids, merged_heap, fields)
        for component in _connected_components(oids, graph):
            if len(component) < 2:
                continue  # a single unlinked node isn't a demonstrated structure
            finding = _classify_component(component, graph, fields)
            if finding is not None:
                findings.append(finding)
                consumed.update(component)

    return findings


def _group_instances_by_type(merged_heap: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for oid, obj in merged_heap.items():
        obj_type = obj.get("type")
        if not isinstance(obj_type, str) or obj_type in BUILTIN_HEAP_TYPES or "fields" not in obj:
            continue
        groups.setdefault(obj_type, []).append(oid)
    return groups


def _pointer_fields(oids: list[str], merged_heap: dict[str, dict[str, Any]]) -> list[str]:
    """Field names that, on every instance where present, hold either None
    or a reference to another instance of the same type group."""
    oid_set = set(oids)
    field_names: set[str] = set()
    for oid in oids:
        field_names.update(merged_heap[oid].get("fields", {}).keys())

    pointer_fields = []
    for field in sorted(field_names):
        qualifies = True
        saw_any = False
        for oid in oids:
            value = merged_heap[oid].get("fields", {}).get(field)
            if value is None:
                continue
            saw_any = True
            if is_none_value(value):
                continue
            ref = value_ref(value)
            if ref is None or ref not in oid_set:
                qualifies = False
                break
        if qualifies and saw_any:
            pointer_fields.append(field)
    return pointer_fields


def _build_pointer_graph(
    oids: list[str], merged_heap: dict[str, dict[str, Any]], fields: list[str]
) -> dict[str, dict[str, str | None]]:
    graph: dict[str, dict[str, str | None]] = {}
    for oid in oids:
        obj_fields = merged_heap[oid].get("fields", {})
        graph[oid] = {}
        for field in fields:
            value = obj_fields.get(field)
            graph[oid][field] = value_ref(value)
    return graph


def _connected_components(
    oids: list[str], graph: dict[str, dict[str, str | None]]
) -> list[set[str]]:
    undirected: dict[str, set[str]] = {oid: set() for oid in oids}
    for oid, targets in graph.items():
        for target in targets.values():
            if target is not None and target in undirected:
                undirected[oid].add(target)
                undirected[target].add(oid)

    seen: set[str] = set()
    components: list[set[str]] = []
    for start in oids:
        if start in seen:
            continue
        stack = [start]
        component: set[str] = set()
        while stack:
            node = stack.pop()
            if node in component:
                continue
            component.add(node)
            stack.extend(undirected[node] - component)
        seen |= component
        components.append(component)
    return components


def _classify_component(
    component: set[str], graph: dict[str, dict[str, str | None]], fields: list[str]
) -> dict[str, Any] | None:
    in_degree: dict[str, int] = {oid: 0 for oid in component}
    for oid in component:
        for target in graph[oid].values():
            if target is not None and target in in_degree:
                in_degree[target] += 1

    roots = [oid for oid in component if in_degree[oid] == 0]
    max_in_degree = max(in_degree.values())

    if (
        len(fields) == 2
        and max_in_degree <= 1
        and len(roots) == 1
        and not _has_cycle(component, graph)
    ):
        return {
            "kind": "binary_tree",
            "root_ref": roots[0],
            "confidence": CONFIDENCE["binary_tree"],
        }

    # Anything else pointer-chained (a single field, or two fields with the
    # back-reference symmetry of a doubly-linked list, or a cyclic ring) is
    # a linked_list. Pick a root even when every node has an incoming edge
    # (a genuinely circular list): the lowest-numbered oid is at least
    # deterministic.
    root = roots[0] if roots else min(component, key=_oid_number)
    note = None
    if not roots:
        note = "circular — no unreferenced node to anchor a root"
    elif _has_cycle(component, graph):
        note = "contains a cycle"
    return {
        "kind": "linked_list",
        "root_ref": root,
        "confidence": CONFIDENCE["linked_list"] if not note else CONFIDENCE["linked_list"] - 0.15,
        **({"note": note} if note else {}),
    }


def _has_cycle(component: set[str], graph: dict[str, dict[str, str | None]]) -> bool:
    # DFS cycle check over the directed pointer edges, restricted to this
    # component. A tree can never have a cycle by construction (each node
    # has <=1 incoming edge and there's a single root) but a "linked_list"
    # component might, e.g. a node whose `next` loops back — walk it
    # explicitly instead of assuming.
    color: dict[str, int] = dict.fromkeys(component, 0)  # 0=white,1=gray,2=black

    def visit(node: str) -> bool:
        color[node] = 1
        for target in graph[node].values():
            if target is None or target not in color:
                continue
            if color[target] == 1:
                return True
            if color[target] == 0 and visit(target):
                return True
        color[node] = 2
        return False

    return any(color[node] == 0 and visit(node) for node in component)


def _oid_number(oid: str) -> int:
    try:
        return int(oid[1:])
    except ValueError:
        return 0


# -- dict-backed structures: graph / hash_map -----------------------------------


def _detect_dict_structures(
    merged_heap: dict[str, dict[str, Any]], consumed: set[str]
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for oid, obj in merged_heap.items():
        if oid in consumed or obj.get("type") != "dict":
            continue
        entries = obj.get("entries", [])
        if entries and _looks_like_adjacency(entries, merged_heap):
            findings.append({"kind": "graph", "root_ref": oid, "confidence": CONFIDENCE["graph"]})
            # The adjacency lists themselves are part of this structure, not
            # independent arrays of their own.
            for entry in entries:
                ref = value_ref(entry.get("value"))
                if ref is not None:
                    consumed.add(ref)
        else:
            findings.append(
                {"kind": "hash_map", "root_ref": oid, "confidence": CONFIDENCE["hash_map"]}
            )
        consumed.add(oid)
    return findings


def _looks_like_adjacency(
    entries: list[dict[str, Any]], merged_heap: dict[str, dict[str, Any]]
) -> bool:
    """An adjacency dict is a graph (PRD §4.3): every value is a reference
    to a list or set (the neighbor collection), not a scalar."""
    container_values = 0
    for entry in entries:
        ref = value_ref(entry.get("value"))
        if ref is not None and merged_heap.get(ref, {}).get("type") in ("list", "set", "tuple"):
            container_values += 1
    return container_values == len(entries) and container_values > 0


# -- list-backed structures: array / array_2d / stack / queue ------------------


def _detect_list_structures(
    trace: dict[str, Any], merged_heap: dict[str, dict[str, Any]], consumed: set[str]
) -> list[dict[str, Any]]:
    # Two passes: first identify every array_2d (and consume its row refs),
    # since dict-merge insertion order can put a row's oid before its
    # parent's — a single pass could classify a row as its own "array"
    # before ever reaching the container that owns it.
    array_2d_oids: set[str] = set()
    for oid, obj in merged_heap.items():
        if oid in consumed or obj.get("type") not in ("list", "tuple"):
            continue
        items = obj.get("items", [])
        item_refs = [value_ref(item) for item in items]
        if items and all(
            ref is not None and merged_heap.get(ref, {}).get("type") in ("list", "tuple")
            for ref in item_refs
        ):
            array_2d_oids.add(oid)
            consumed.update(ref for ref in item_refs if ref is not None)

    findings: list[dict[str, Any]] = []
    for oid in array_2d_oids:
        findings.append({"kind": "array_2d", "root_ref": oid, "confidence": CONFIDENCE["array_2d"]})
        consumed.add(oid)

    for oid, obj in merged_heap.items():
        if oid in consumed or obj.get("type") not in ("list", "tuple"):
            continue
        access_kind = _classify_access_pattern(trace, oid)
        findings.append(
            {
                "kind": access_kind or "array",
                "root_ref": oid,
                "confidence": CONFIDENCE[access_kind] if access_kind else CONFIDENCE["array"],
            }
        )
        consumed.add(oid)
    return findings


def _classify_access_pattern(trace: dict[str, Any], oid: str) -> str | None:
    """Stack (append+pop, both at the same end) or queue (enqueue at one
    end, dequeue at the other) — inferred purely from how the list's
    contents change over time, never from the variable's name."""
    history = heap_object_length_history(trace, oid)
    end_growth = end_shrink = front_growth = front_shrink = 0
    other = 0

    prev_keys: list[str] | None = None
    for _step_i, items in history:
        keys = [item_key(v) for v in items]
        # A transition into or out of the empty list carries no positional
        # evidence for "front" vs "end" (slicing either end of a 0-or-1
        # element list gives the same empty result) — skip it entirely
        # rather than let it masquerade as an end-growth/shrink match or
        # pollute `other`.
        if prev_keys is not None and (len(prev_keys) == 0 or len(keys) == 0):
            prev_keys = keys
            continue
        if prev_keys is not None and keys != prev_keys:
            if len(keys) == len(prev_keys) + 1:
                if keys[:-1] == prev_keys:
                    end_growth += 1
                elif keys[1:] == prev_keys:
                    front_growth += 1
                else:
                    other += 1
            elif len(keys) == len(prev_keys) - 1:
                if keys == prev_keys[:-1]:
                    end_shrink += 1
                elif keys == prev_keys[1:]:
                    front_shrink += 1
                else:
                    other += 1
            elif len(keys) != len(prev_keys):
                other += 1
        prev_keys = keys

    if other > 0:
        return None
    if end_growth > 0 and end_shrink > 0 and front_growth == 0 and front_shrink == 0:
        return "stack"
    if end_growth > 0 and front_shrink > 0 and front_growth == 0 and end_shrink == 0:
        return "queue"
    if front_growth > 0 and end_shrink > 0 and end_growth == 0 and front_shrink == 0:
        return "queue"
    return None
