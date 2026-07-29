"""Shared heap-snapshot utilities used by structure_detector and
insight_scanner. Operates on raw trace dicts (trace.schema.json shape), not
Pydantic models — a 40k-step trace is expensive enough to walk once without
also paying full model validation on every heap object.
"""

from __future__ import annotations

from typing import Any

BUILTIN_HEAP_TYPES = {"list", "tuple", "dict", "set", "str", "function", "opaque"}


def merge_heap_across_steps(trace: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """The fullest known snapshot of every heap object that ever appeared.

    A given heap id's *shape* (its type and field/key names) never changes
    over its lifetime — only field values do — so the last-seen snapshot of
    each id is enough to classify structure, without needing to pick "the"
    step to look at.
    """
    merged: dict[str, dict[str, Any]] = {}
    for step in trace.get("steps", []):
        merged.update(step.get("heap", {}))
    return merged


def value_ref(value: dict[str, Any] | None) -> str | None:
    """The heap id a Value points at, or None if it's not a reference."""
    if isinstance(value, dict) and "ref" in value:
        ref = value["ref"]
        return ref if isinstance(ref, str) else None
    return None


def is_none_value(value: dict[str, Any] | None) -> bool:
    if value is None:
        return True
    return isinstance(value, dict) and "val" in value and value["val"] is None


def heap_object_length_history(
    trace: dict[str, Any], oid: str
) -> list[tuple[int, list[Any]]]:
    """Every (step_i, items) observation of a list/tuple/set heap object,
    in step order, wherever it appears in that step's heap. Used for
    access-pattern classification (stack/queue) in structure_detector and
    the mutation-during-iteration detector in insight_scanner.
    """
    history: list[tuple[int, list[Any]]] = []
    for step in trace.get("steps", []):
        obj = step.get("heap", {}).get(oid)
        if obj is not None and obj.get("type") in ("list", "tuple", "set"):
            history.append((step["i"], obj.get("items", [])))
    return history


def item_key(value: dict[str, Any] | None) -> str:
    """A hashable, order-and-value-sensitive key for one Value, good enough
    to detect "did this element change" without deep equality machinery.
    Heap-referenced elements are compared by id, which is exactly right:
    the same object stays "the same element" across steps regardless of
    what its own fields later mutate to.
    """
    ref = value_ref(value)
    if ref is not None:
        return f"ref:{ref}"
    if is_none_value(value):
        return "none"
    if isinstance(value, dict) and "val" in value:
        return f"val:{value['val']!r}"
    return repr(value)
