"""Wire optimisation (docs/PRD.md §3.4, Phase 6): every step's `heap` field
starts as a full snapshot, which compresses well under gzip but is still the
dominant cost of a trace's wire size — consecutive steps are near-identical
because most of a heap survives untouched from one step to the next. This
module rewrites a full-snapshot trace into a keyframe scheme: every `interval`
steps (by position in `steps`, not by `.i` — a head+tail-truncated trace's
`.i` values aren't contiguous, the same reason `lib/player/ticks.ts` indexes
by position) keeps its full `heap`; every other step gets an RFC 6902 JSON
Patch (`heap_patch`) from the *previous step's reconstructed heap* to its own,
and its own `heap` is dropped.

This only ever runs on a trace already fully produced by the executor (or a
cache hit) — never inside `run_pipeline`. Every deterministic analyzer
(`digest`, `structure_detector`, `insight_scanner`, `complexity_analyst`,
`heap_graph`) needs random per-step heap access and must keep working exactly
as before, so `encode_keyframed` is applied exactly once, at the last moment
before a trace leaves this process: in `routers/runs.py`, on the response body
(the actual wire to the browser today). `app.storage.trace_store.TraceStore`
isn't wired into any request path yet (permalinks are a future feature, per
its own module docstring) — when it is, that `put()` call should encode the
same way, for the same reason. The Redis deterministic-output cache
(`app/cache.py`) stores the *raw*, un-encoded trace — decoding on every cache
hit would defeat the point, and `digest` is recomputed from that cached trace
on every hit regardless.

The frontend never sees this as a special case: `apps/web/lib/player/
getStateAt.ts` is the seam PRD §3.4 calls out, and it's the one place that
walks back to the nearest keyframe and replays patches forward.
"""

from __future__ import annotations

import copy
from typing import Any

DEFAULT_KEYFRAME_INTERVAL = 50

_JSON_POINTER_ESCAPES = (("~", "~0"), ("/", "~1"))


def _pointer_escape(token: str) -> str:
    for raw, escaped in _JSON_POINTER_ESCAPES:
        token = token.replace(raw, escaped)
    return token


def diff_json(old: Any, new: Any, *, path: str = "") -> list[dict[str, Any]]:
    """A generic RFC 6902 diff (add/remove/replace only — no move/copy/test,
    since nothing downstream ever needs to emit or apply those) over
    JSON-shaped dict/list/scalar values. Not maximally compact for a
    non-trailing list insert/delete (e.g. `list.insert(0, ...)` — already
    flagged as a rare accidental-O(n²) antipattern by `insight_scanner`, not
    the case this is optimizing for) — see module tests for the worked
    example proving that shape is still reconstructed correctly, just as a
    full run of per-index replaces plus a trailing add instead of one
    minimal insert op.
    """
    if type(old) is dict and type(new) is dict:
        ops: list[dict[str, Any]] = []
        for key in old:
            if key not in new:
                ops.append({"op": "remove", "path": f"{path}/{_pointer_escape(str(key))}"})
        for key in new:
            child_path = f"{path}/{_pointer_escape(str(key))}"
            if key not in old:
                ops.append({"op": "add", "path": child_path, "value": new[key]})
            elif old[key] != new[key]:
                ops.extend(diff_json(old[key], new[key], path=child_path))
        return ops

    if type(old) is list and type(new) is list:
        ops = []
        common = min(len(old), len(new))
        for idx in range(common):
            if old[idx] != new[idx]:
                ops.extend(diff_json(old[idx], new[idx], path=f"{path}/{idx}"))
        if len(new) > len(old):
            for idx in range(len(old), len(new)):
                ops.append({"op": "add", "path": f"{path}/{idx}", "value": new[idx]})
        elif len(new) < len(old):
            for idx in range(len(old) - 1, len(new) - 1, -1):
                ops.append({"op": "remove", "path": f"{path}/{idx}"})
        return ops

    return [{"op": "replace", "path": path, "value": new}]


def apply_json_patch(document: Any, patch: list[dict[str, Any]]) -> Any:
    """Applies an RFC 6902 add/remove/replace patch produced by `diff_json`.
    A Python-side mirror of `apps/web/lib/player/jsonPatch.ts`'s
    `applyJsonPatch` — kept only so the codec's own round-trip tests don't
    need a second language to prove correctness; the real decode path always
    runs in the browser.
    """
    result = copy.deepcopy(document)
    for op in patch:
        tokens = [_pointer_unescape(t) for t in op["path"].split("/")[1:]]
        _apply_one(result, tokens, op)
    return result


def _pointer_unescape(token: str) -> str:
    return token.replace("~1", "/").replace("~0", "~")


def _apply_one(root: Any, tokens: list[str], op: dict[str, Any]) -> None:
    container = root
    for token in tokens[:-1]:
        container = container[int(token)] if isinstance(container, list) else container[token]
    last = tokens[-1]
    kind = op["op"]
    if isinstance(container, list):
        index = len(container) if last == "-" else int(last)
        if kind == "add":
            container.insert(index, op["value"])
        elif kind == "remove":
            del container[index]
        else:  # replace
            container[index] = op["value"]
    else:
        if kind in ("add", "replace"):
            container[last] = op["value"]
        else:  # remove
            del container[last]


def encode_keyframed(trace: dict[str, Any], *, interval: int = DEFAULT_KEYFRAME_INTERVAL) -> dict[str, Any]:
    """Returns a new trace dict whose `steps` use the keyframe+patch scheme.
    Never mutates `trace`. Idempotent-adjacent: re-encoding an
    already-encoded trace first reconstructs each step's full heap (from
    whatever keyframe/patch shape it's already in) before re-diffing, so
    calling this twice is safe, just wasted work — callers should still only
    do it once, at the point a trace leaves the process (see module
    docstring).
    """
    new_steps: list[dict[str, Any]] = []
    prev_heap: dict[str, Any] | None = None

    for pos, step in enumerate(trace["steps"]):
        current_heap = _reconstruct_step_heap(step, prev_heap)
        new_step = {k: v for k, v in step.items() if k not in ("heap", "heap_patch")}

        if pos % interval == 0 or prev_heap is None:
            new_step["heap"] = current_heap
        else:
            new_step["heap_patch"] = diff_json(prev_heap, current_heap, path="")

        new_steps.append(new_step)
        prev_heap = current_heap

    return {**trace, "steps": new_steps}


def decode_step_heap(steps: list[dict[str, Any]], i: int) -> dict[str, Any]:
    """Reference decoder mirroring `getStateAt.ts`'s reconstruction, used by
    this module's own tests and by the payload-reduction measurement script
    (`scripts/measure_wire_savings.py`) to prove the encoded form actually
    reconstructs byte-identical heaps, not just "smaller."
    """
    keyframe_pos = i
    while "heap" not in steps[keyframe_pos]:
        keyframe_pos -= 1

    heap = steps[keyframe_pos]["heap"]
    for pos in range(keyframe_pos + 1, i + 1):
        heap = _reconstruct_step_heap(steps[pos], heap)
    return heap


def _reconstruct_step_heap(step: dict[str, Any], prev_heap: dict[str, Any] | None) -> dict[str, Any]:
    if "heap" in step:
        return step["heap"]
    assert prev_heap is not None, "a step with heap_patch must follow a step with a known heap"
    return apply_json_patch(prev_heap, step.get("heap_patch", []))
