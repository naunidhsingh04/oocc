#!/usr/bin/env python3
"""Generates fixtures/cpp/*.trace.json (+ .analysis.json/.plan.json) from
fixtures/cpp/programs/*.cpp, running each through the real Phase 4 pipeline:
cpp_executor.instrument (the libclang pass) -> wasi-sdk clang++ -> WASM ->
executed under Node's built-in WASI implementation (a stand-in for the
browser worker shim during fixture generation; the wasm bytes and the
trace they produce are identical either way — only the WASI host differs).

Mirrors fixtures/generator/generate_analysis.py's role for the Python
fixtures: a throwaway script, not part of the shipped product, run once per
fixture change and its output committed.

Usage: uv run --package oocc-cpp-executor python fixtures/cpp/generate.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

FIXTURES_CPP_DIR = Path(__file__).resolve().parent
PROGRAMS_DIR = FIXTURES_CPP_DIR / "programs"
REPO_ROOT = FIXTURES_CPP_DIR.parent.parent

sys.path.insert(0, str(REPO_ROOT / "services" / "cpp-executor"))
sys.path.insert(0, str(REPO_ROOT / "packages" / "contracts" / "python" / "src"))
sys.path.insert(0, str(REPO_ROOT / "apps" / "api"))

import oocc_contracts as contracts  # noqa: E402
from app.analysis.structure_detector import detect_structures  # noqa: E402
from app.analysis.viz_planner import plan_viz  # noqa: E402
from cpp_executor.instrument import instrument, source_hash  # noqa: E402
from cpp_executor.toolchain import compile_to_wasm, wasi_clang_args  # noqa: E402

FIXTURE_NAMES = [
    "linked_list_reversal",
    "vector_sort",
    "bst_insert",
    "dfs_adjacency_list",
    "pointer_aliasing",
    "out_of_bounds_write",
    "two_sum",
    "fibonacci_recursion",
    "quicksort_partition",
    "n_queens",
    "dp_knapsack",
]

_RUN_WASI_JS = REPO_ROOT / ".toolchains" / "run_wasi.mjs"
_RUN_WASI_JS.write_text(
    """
import { WASI } from "node:wasi";
import { readFile } from "node:fs/promises";
const wasi = new WASI({ version: "preview1", args: [], env: {}, returnOnExit: true });
const bytes = await readFile(process.argv[2]);
const { instance } = await WebAssembly.instantiate(
  bytes,
  { wasi_snapshot_preview1: wasi.wasiImport }
);
try {
  wasi.start(instance);
} catch (e) {
  // A genuine WASM trap (e.g. an out-of-bounds memory access) kills the
  // instance immediately — no C++ unwind, so oocc_engine.hpp's normal
  // fd-1 write of the finished trace never ran. Its linear memory is
  // still readable from here though, so pull out whatever the trap
  // buffer holds (every step completed before the trap) directly, and
  // hand it to the Python caller on stdout with a marker line — this is
  // exactly the recovery path apps/web's browser worker shim performs
  // for real, just run from Node instead of a Worker for fixture
  // generation.
  const ptr = instance.exports.oocc_trap_buffer_ptr();
  const len = instance.exports.oocc_trap_buffer_len();
  const bytes2 = new Uint8Array(instance.exports.memory.buffer, ptr, len);
  const ndjson = new TextDecoder().decode(bytes2);
  process.stdout.write("OOCC_TRAP_BUFFER_BEGIN\\n" + ndjson + "OOCC_TRAP_BUFFER_END\\n");
  process.stderr.write("OOCC_TRAP_MESSAGE:" + (e && e.message ? e.message : String(e)) + "\\n");
  process.exitCode = 42;
}
"""
)


def run_wasm(wasm_path: Path) -> tuple[str, bool, str]:
    """Returns (stdout, trapped, trap_message)."""
    result = subprocess.run(
        ["node", "--no-warnings", str(_RUN_WASI_JS), str(wasm_path)],
        capture_output=True,
        text=True,
        # `text=True` alone decodes with `locale.getpreferredencoding()` —
        # cp1252 on this Windows sandbox, not UTF-8 — which crashed the
        # reader thread on the first non-cp1252 byte in a real trace's JSON
        # output (found for real generating n_queens.trace.json, the first
        # fixture on this machine with output large/varied enough to hit
        # it) and silently turned `result.stdout` into `None` rather than
        # raising somewhere visible. The wasm side always emits UTF-8 (see
        # oocc_engine.hpp's CapturingStreambuf), so this is the correct
        # decoding regardless of host locale, not just a Windows patch.
        encoding="utf-8",
    )
    trapped = result.returncode == 42
    trap_message = ""
    if trapped:
        for line in result.stderr.splitlines():
            if line.startswith("OOCC_TRAP_MESSAGE:"):
                trap_message = line[len("OOCC_TRAP_MESSAGE:") :]
    return result.stdout, trapped, trap_message


def _parse_trap_buffer(stdout: str) -> list[dict]:
    begin = stdout.index("OOCC_TRAP_BUFFER_BEGIN\n") + len("OOCC_TRAP_BUFFER_BEGIN\n")
    end = stdout.index("OOCC_TRAP_BUFFER_END\n")
    ndjson = stdout[begin:end]
    return [json.loads(line) for line in ndjson.splitlines() if line.strip()]


def generate_one(name: str) -> None:
    cpp_src = (PROGRAMS_DIR / f"{name}.cpp").read_text()
    run_id = "r_cppfix" + str(abs(hash(name)))[:12]
    result = instrument(cpp_src, run_id=run_id, extra_clang_args=wasi_clang_args())
    if not result.ok:
        raise SystemExit(f"[{name}] instrumentation failed: {result.diagnostics}")

    wasm_path = FIXTURES_CPP_DIR / f".{name}.build.wasm"
    proc = compile_to_wasm(result.instrumented_source, wasm_path)
    if proc.returncode != 0:
        raise SystemExit(f"[{name}] wasm compile failed:\n{proc.stderr}")

    expected_hash = source_hash(cpp_src)
    stdout, trapped, trap_message = run_wasm(wasm_path)

    if trapped:
        steps = _parse_trap_buffer(stdout)
        trace = {
            "schema_version": "1.0",
            "run_id": run_id,
            "language": "cpp",
            "source_hash": expected_hash,
            "status": "runtime_error",
            "meta": {
                "duration_ms": 0,
                "step_count": len(steps),
                "truncated": False,
                "stdin": "",
                "peak_heap_objects": len({oid for s in steps for oid in s["heap"]}),
            },
            "error": {
                "type": "wasm_trap",
                "message": trap_message or "WebAssembly trap",
                "step": len(steps) - 1 if steps else 0,
            },
            "steps": steps,
        }
        contracts.validate_trace(trace)
        (FIXTURES_CPP_DIR / f"{name}.trace.json").write_text(json.dumps(trace, indent=2) + "\n")

        structures = detect_structures(trace)
        analysis = {"structures": structures, "insights": []}
        contracts.validate_analysis(analysis)
        (FIXTURES_CPP_DIR / f"{name}.analysis.json").write_text(
            json.dumps(analysis, indent=2) + "\n"
        )

        plan = plan_viz(cpp_src, structures, trace)
        (FIXTURES_CPP_DIR / f"{name}.plan.json").write_text(json.dumps(plan, indent=2) + "\n")

        print(
            f"[{name}] TRAPPED as expected: status=runtime_error recovered_steps={len(steps)} "
            f"error={trap_message!r} — last good step is playable"
        )
        wasm_path.unlink()
        wasm_path.with_suffix(".instrumented.cpp").unlink()
        return

    trace = json.loads(stdout)
    contracts.validate_trace(trace)

    assert trace["source_hash"] == expected_hash, "source_hash mismatch"

    (FIXTURES_CPP_DIR / f"{name}.trace.json").write_text(json.dumps(trace, indent=2) + "\n")

    structures = detect_structures(trace)
    analysis = {"structures": structures, "insights": []}
    contracts.validate_analysis(analysis)
    (FIXTURES_CPP_DIR / f"{name}.analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")

    plan = plan_viz(cpp_src, structures, trace)
    (FIXTURES_CPP_DIR / f"{name}.plan.json").write_text(json.dumps(plan, indent=2) + "\n")

    print(
        f"[{name}] status={trace['status']} steps={len(trace['steps'])} "
        f"structures={len(structures)} panels={[p['type'] for p in plan['panels']]}"
    )

    wasm_path.unlink()
    wasm_path.with_suffix(".instrumented.cpp").unlink()


def main() -> None:
    only = sys.argv[1:] or FIXTURE_NAMES
    for name in only:
        generate_one(name)


if __name__ == "__main__":
    main()
