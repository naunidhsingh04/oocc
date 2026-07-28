"""docs/PRD.md §3.4 (Phase 6): measure the keyframe+patch wire scheme's real
payload reduction. Run with:

    uv run --package oocc-api python apps/api/scripts/measure_wire_savings.py

Reports two numbers, not one, because they tell different stories:

1. `fixtures/large_trace_40k.trace.json` — the fixture PRD names explicitly.
   It's a 40k-step *step-count* stress fixture (a tight numeric loop, no
   containers), so its heap is empty on every step. The keyframe+patch
   scheme has nothing to diff and shows ~0% (occasionally slightly negative,
   from the `heap_patch: []` wrapper's own bytes) — an honest result, not a
   bug, and worth stating plainly rather than only reporting a flattering
   number from a different fixture.
2. A synthetic bubble-sort-on-300-elements trace, generated fresh by the real
   `services/executor` tracer — the actual case this feature targets: many
   steps *and* a real, repeatedly-mutated container. None of the twelve
   committed fixtures happen to combine both (they're kept small on purpose
   for fast, readable tests), so this script builds a representative one
   instead of asserting a misleading number against the wrong fixture.
"""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))
sys.path.insert(0, str(REPO_ROOT / "services" / "executor"))

from app.storage.wire_codec import decode_step_heap, encode_keyframed  # noqa: E402
from executor_app.tracer import Tracer  # noqa: E402

BUBBLE_SORT_300_SOURCE = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

seed = 12345
numbers = []
for k in range(300):
    seed = (seed * 1103515245 + 12345) % 2147483648
    numbers.append(seed % 10000)
sorted_numbers = bubble_sort(numbers)
print(sorted_numbers[0])
"""


def _report(label: str, trace: dict) -> None:
    encoded = encode_keyframed(trace)

    for i, step in enumerate(trace["steps"]):
        assert decode_step_heap(encoded["steps"], i) == step["heap"], f"reconstruction mismatch at step {i}"

    original_raw = json.dumps(trace).encode()
    encoded_raw = json.dumps(encoded).encode()
    original_gz = gzip.compress(original_raw)
    encoded_gz = gzip.compress(encoded_raw)
    keyframe_count = sum(1 for s in encoded["steps"] if "heap" in s)

    def pct(before: int, after: int) -> str:
        change = 100 * (1 - after / before)
        sign = "smaller" if change >= 0 else "LARGER"
        return f"{abs(change):.1f}% {sign}"

    print(f"\n=== {label} ===")
    print(f"steps: {len(trace['steps']):,} ({keyframe_count:,} kept as keyframes)")
    print(f"raw JSON:   {len(original_raw):>10,} -> {len(encoded_raw):>10,} bytes  ({pct(len(original_raw), len(encoded_raw))})")
    print(f"gzip'd:     {len(original_gz):>10,} -> {len(encoded_gz):>10,} bytes  ({pct(len(original_gz), len(encoded_gz))})")
    print("reconstruction: every step verified byte-identical to the original")


def main() -> None:
    fixture_path = REPO_ROOT / "fixtures" / "large_trace_40k.trace.json"
    _report("fixtures/large_trace_40k.trace.json (PRD-named fixture; empty heap throughout)", json.loads(fixture_path.read_text()))

    tracer = Tracer(step_limit=200_000, keep_head=200_000, keep_tail=0, wall_clock_limit_s=60)
    synthetic = tracer.run(BUBBLE_SORT_300_SOURCE)
    _report("synthetic bubble_sort(300 elements) (representative heap-heavy case)", synthetic)


if __name__ == "__main__":
    main()
