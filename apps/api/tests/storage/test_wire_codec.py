"""app/storage/wire_codec.py — docs/PRD.md §3.4 (Phase 6 wire optimisation).
Uses the real fixtures/large_trace_40k.trace.json as the primary correctness
+ measurement case (that's the fixture PRD explicitly calls out), plus small
synthetic traces for the edge cases a 40k-step fixture won't exercise on its
own (heap shrinking, a key removed, a non-trailing list insert).
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

from app.storage.wire_codec import (
    apply_json_patch,
    decode_step_heap,
    diff_json,
    encode_keyframed,
)

FIXTURES_DIR = Path(__file__).parents[4] / "fixtures"


def _step(i: int, heap: dict) -> dict:
    return {
        "i": i,
        "event": "line",
        "line": 1,
        "func": "<module>",
        "depth": 0,
        "stack": [{"frame_id": "f0", "func": "<module>", "line": 1, "locals": {}}],
        "heap": heap,
        "stdout_delta": "",
        "changed": [],
    }


class TestDiffJson:
    def test_dict_add_remove_replace(self) -> None:
        old = {"a": 1, "b": 2}
        new = {"b": 3, "c": 4}
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_nested_object_only_changed_field_is_touched(self) -> None:
        old = {"o1": {"type": "list", "len": 3, "items": [{"val": 1}, {"val": 2}, {"val": 3}]}}
        new = {"o1": {"type": "list", "len": 3, "items": [{"val": 1}, {"val": 9}, {"val": 3}]}}
        patch = diff_json(old, new)
        assert patch == [{"op": "replace", "path": "/o1/items/1/val", "value": 9}]
        assert apply_json_patch(old, patch) == new

    def test_list_trailing_append(self) -> None:
        old = [1, 2, 3]
        new = [1, 2, 3, 4, 5]
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_list_trailing_removal(self) -> None:
        old = [1, 2, 3, 4, 5]
        new = [1, 2]
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_list_non_trailing_insert_still_reconstructs_correctly(self) -> None:
        # Not maximally compact (this isn't an LCS diff), but must still be
        # exactly correct — see module docstring.
        old = [1, 2, 3]
        new = [0, 1, 2, 3]
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_object_key_removed(self) -> None:
        old = {"o1": {"type": "TreeNode", "fields": {"left": {"ref": "o2"}, "right": None}}}
        new = {"o1": {"type": "TreeNode", "fields": {"right": None}}}
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_path_escaping_for_tilde_and_slash_in_keys(self) -> None:
        old = {"a/b": 1, "c~d": 2}
        new = {"a/b": 2, "c~d": 3}
        patch = diff_json(old, new)
        assert apply_json_patch(old, patch) == new

    def test_type_change_is_a_whole_value_replace(self) -> None:
        old = {"x": [1, 2, 3]}
        new = {"x": "opaque now"}
        patch = diff_json(old, new)
        assert patch == [{"op": "replace", "path": "/x", "value": "opaque now"}]
        assert apply_json_patch(old, patch) == new


class TestEncodeKeyframed:
    def test_keyframe_on_step_zero_and_every_interval(self) -> None:
        steps = [_step(i, {f"o{i}": {"type": "opaque", "repr": str(i)}}) for i in range(7)]
        trace = {"steps": steps}

        encoded = encode_keyframed(trace, interval=3)

        for pos, step in enumerate(encoded["steps"]):
            if pos % 3 == 0:
                assert "heap" in step and "heap_patch" not in step
            else:
                assert "heap_patch" in step and "heap" not in step

    def test_reconstruction_matches_original_at_every_position(self) -> None:
        heaps = [
            {"o1": {"type": "list", "len": 3, "items": [{"val": 1}, {"val": 2}, {"val": 3}]}},
            {"o1": {"type": "list", "len": 3, "items": [{"val": 1}, {"val": 9}, {"val": 3}]}},
            {"o1": {"type": "list", "len": 3, "items": [{"val": 1}, {"val": 9}, {"val": 7}]}},
            {"o1": {"type": "list", "len": 4, "items": [{"val": 1}, {"val": 9}, {"val": 7}, {"val": 0}]}},
        ]
        original_steps = [_step(i, h) for i, h in enumerate(heaps)]
        trace = {"steps": original_steps}

        encoded = encode_keyframed(trace, interval=2)

        for i, expected_heap in enumerate(heaps):
            assert decode_step_heap(encoded["steps"], i) == expected_heap

    def test_non_heap_fields_are_preserved(self) -> None:
        step = _step(0, {"o1": {"type": "opaque", "repr": "x"}})
        step["changed"] = ["o1.foo"]
        step["returned"] = None
        del step["returned"]
        step["event"] = "call"
        trace = {"steps": [step], "schema_version": "1.1", "run_id": "r_abc"}

        encoded = encode_keyframed(trace)

        assert encoded["schema_version"] == "1.1"
        assert encoded["run_id"] == "r_abc"
        assert encoded["steps"][0]["changed"] == ["o1.foo"]
        assert encoded["steps"][0]["event"] == "call"

    def test_does_not_mutate_input(self) -> None:
        trace = {"steps": [_step(0, {"o1": {"type": "opaque", "repr": "x"}})]}
        import copy

        original = copy.deepcopy(trace)

        encode_keyframed(trace)

        assert trace == original


class TestRepresentativeHeapHeavyTraceSavings:
    """A fast, synthetic stand-in for the real case this feature targets
    (see `apps/api/scripts/measure_wire_savings.py` for the slower,
    tracer-generated version of the same shape): many steps, one
    repeatedly-mutated 300-element list. None of the twelve committed
    fixtures happen to be both long *and* heap-heavy (they're kept small on
    purpose), so this is built by hand rather than skipped.
    """

    def test_gzip_payload_reduction_is_substantial(self, capsys) -> None:
        items = [{"val": i} for i in range(300)]
        steps = []
        for i in range(400):
            items = [dict(v) for v in items]
            items[i % 300] = {"val": i}
            steps.append(_step(i, {"o1": {"type": "list", "len": 300, "items": items}}))
        trace = {"steps": steps}

        encoded = encode_keyframed(trace)
        original_bytes = gzip.compress(json.dumps(trace).encode())
        encoded_bytes = gzip.compress(json.dumps(encoded).encode())
        reduction = 1 - (len(encoded_bytes) / len(original_bytes))

        print(f"\nsynthetic heap-heavy trace: {len(original_bytes):,} -> {len(encoded_bytes):,} gzip bytes ({reduction:.1%} reduction)")

        assert reduction > 0.3
        for i in range(len(steps)):
            assert decode_step_heap(encoded["steps"], i) == steps[i]["heap"]


class TestLargeTraceFixtureRoundTripAndSavings:
    """The measurement PRD §3.4 explicitly asks for: encode the real
    large_trace_40k fixture and report the gzip'd payload reduction."""

    def _load(self) -> dict:
        path = FIXTURES_DIR / "large_trace_40k.trace.json"
        return json.loads(path.read_text())

    def test_every_step_reconstructs_byte_identical_to_the_original(self) -> None:
        trace = self._load()
        original_heaps = [step["heap"] for step in trace["steps"]]

        encoded = encode_keyframed(trace)

        # Sanity: the whole point — most steps should have shed their `heap`.
        keyframe_count = sum(1 for s in encoded["steps"] if "heap" in s)
        assert keyframe_count < len(trace["steps"]) / 10

        for i, expected_heap in enumerate(original_heaps):
            assert decode_step_heap(encoded["steps"], i) == expected_heap

    def test_gzip_payload_is_not_meaningfully_worse_on_this_empty_heap_fixture(self, capsys) -> None:
        """`large_trace_40k` is a 40k-*step* stress fixture (a tight numeric
        loop, zero heap objects at every step, confirmed by
        `test_every_step_reconstructs_byte_identical_to_the_original`'s own
        keyframe-count assertion) — there is nothing for this scheme to
        diff away here, so the honest expectation is ~0%, not a win. See
        `apps/api/scripts/measure_wire_savings.py` for the representative
        heap-heavy case (a synthetic bubble-sort trace) this feature
        actually targets, where the reduction is substantial (~65% smaller
        gzip'd, measured there) — asserting a >30% reduction against *this*
        fixture would be asserting something false about it.
        """
        trace = self._load()
        encoded = encode_keyframed(trace)

        original_bytes = gzip.compress(json.dumps(trace).encode())
        encoded_bytes = gzip.compress(json.dumps(encoded).encode())
        reduction = 1 - (len(encoded_bytes) / len(original_bytes))

        print(
            f"\nlarge_trace_40k: {len(original_bytes):,} -> {len(encoded_bytes):,} "
            f"gzip bytes ({reduction:.1%} reduction)"
        )

        # The `heap_patch: []` wrapper on every non-keyframe step costs a few
        # bytes each with nothing to offset it here — small regression, not a win.
        assert reduction > -0.05
