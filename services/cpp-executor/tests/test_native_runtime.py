"""Compiles and runs the native (non-WASM) runtime tests under
tests/native/ as part of the normal pytest suite — native clang++ compiles
in milliseconds versus a wasi-sdk round trip, so this is the fast inner
loop for the runtime itself (oocc_runtime.hpp/oocc_trace.hpp/
oocc_engine.hpp); the wasm target is exercised separately by
test_compile_service.py and fixtures/cpp/generate.py, which is what
actually catches anything genuinely target-specific (see
test_compile_service.py's docstring)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from oocc_contracts import validate_trace  # noqa: E402

NATIVE_DIR = Path(__file__).resolve().parent / "native"
RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"


def _compile_and_run(cpp_file: Path, tmp_path: Path) -> subprocess.CompletedProcess:
    binary = tmp_path / cpp_file.stem
    compile_proc = subprocess.run(
        [
            "clang++", "-std=c++17", "-Wall", "-Wextra", "-Wno-unused-parameter",
            "-O0", "-g", str(cpp_file), "-o", str(binary),
        ],
        capture_output=True,
        text=True,
    )
    assert compile_proc.returncode == 0, compile_proc.stderr
    return subprocess.run([str(binary)], capture_output=True, text=True)


def test_allocator_assertions_pass(tmp_path: Path):
    result = _compile_and_run(NATIVE_DIR / "test_allocator.cpp", tmp_path)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "all assertions passed" in result.stdout


def test_stl_printers_compile_and_run_natively(tmp_path: Path):
    # Covers array/pair/list/deque/map/unordered_map/set/unordered_set/
    # optional/stack/queue/priority_queue — none of which any of the six
    # committed fixtures exercise (they only touch vector/string/user
    # structs), so this is the only thing standing between the adaptor
    # pointer-to-member tricks (stack/queue/priority_queue) and a silent
    # regression.
    result = _compile_and_run(NATIVE_DIR / "test_stl_printers.cpp", tmp_path)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "all assertions passed" in result.stdout


def test_linked_list_hand_instrumented_produces_valid_reversed_trace(tmp_path: Path):
    result = _compile_and_run(NATIVE_DIR / "test_linked_list_hand_instrumented.cpp", tmp_path)
    assert result.returncode == 0, result.stderr
    trace = json.loads(result.stdout)
    validate_trace(trace)
    assert trace["status"] == "ok"

    last_step = trace["steps"][-1]
    reversed_head_ref = last_step["returned"]["ref"]
    heap = last_step["heap"]

    # Walk the pointer chain from the returned head and confirm it's the
    # correctly-reversed 3 -> 2 -> 1 list the fixture builds (1 -> 2 -> 3
    # originally; see the .cpp file).
    values = []
    node_ref = reversed_head_ref
    while node_ref is not None:
        node = heap[node_ref]
        values.append(node["fields"]["val"]["val"])
        next_field = node["fields"]["next"]
        node_ref = next_field["ref"] if "ref" in next_field else None
    assert values == [3, 2, 1]
