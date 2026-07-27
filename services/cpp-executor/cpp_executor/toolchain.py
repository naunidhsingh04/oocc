"""wasi-sdk toolchain integration (PRD §3.5 build step 6): resolves the
wasi-sdk install this sandbox downloaded to `.toolchains/` (no Homebrew
formula exists for it — see the top-level README note this generates —
so it's a plain extracted release tarball, not a package-manager
dependency), and wraps the two things every caller needs: the exact clang
args to parse *against* (for cpp_executor.instrument's libclang AST) and
compile *with* (the actual wasm32-wasi cross-compile).

These two must stay in lockstep — parsing against a different standard
library than the one actually linked risks the AST disagreeing with what
gets compiled (see instrument.py's docstring on this same point) — which
is why both pull from the same RUNTIME_DIR/WASI_SDK_DIR constants here
rather than each caller hand-rolling its own flag list.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = REPO_ROOT / "services" / "cpp-executor" / "runtime"
WASI_SDK_DIR = REPO_ROOT / ".toolchains" / "wasi-sdk-33.0-arm64-macos"


class ToolchainNotFoundError(RuntimeError):
    pass


def _require_sdk() -> Path:
    if not WASI_SDK_DIR.exists():
        raise ToolchainNotFoundError(
            f"wasi-sdk not found at {WASI_SDK_DIR}. Download the arm64-macos release tarball from "
            "https://github.com/WebAssembly/wasi-sdk/releases and extract it to .toolchains/ "
            "(no Homebrew formula exists for wasi-sdk as of this writing)."
        )
    return WASI_SDK_DIR


def wasi_clang_args() -> list[str]:
    """Args for parsing (libclang) against the wasi-sdk headers — passed
    through from the target driver's own `-v` include-search-path output,
    since Apple's bundled libclang (what cpp_executor.instrument parses
    with; see its docstring) doesn't know wasi-sdk's resource directory or
    multilib layout on its own."""
    sdk = _require_sdk()
    sysroot = sdk / "share" / "wasi-sysroot"
    return [
        "--target=wasm32-wasi",
        f"--sysroot={sysroot}",
        f"-resource-dir={sdk / 'lib' / 'clang' / '22'}",
        "-isystem",
        str(sysroot / "include" / "wasm32-wasi" / "noeh" / "c++" / "v1"),
        "-isystem",
        str(sysroot / "include" / "c++" / "v1"),
        "-isystem",
        str(sysroot / "include" / "wasm32-wasi"),
        "-isystem",
        str(sysroot / "include"),
    ]


def compile_to_wasm(
    instrumented_source: str,
    out_wasm: Path,
    *,
    extra_args: list[str] | None = None,
) -> subprocess.CompletedProcess:
    """Compiles already-instrumented C++ source to a wasm32-wasi module.
    `extra_args` is where callers pass memory-limit linker flags for the
    out-of-bounds-write fixture (see fixtures/cpp/programs/out_of_bounds_write.cpp)."""
    sdk = _require_sdk()
    src_path = out_wasm.with_suffix(".instrumented.cpp")
    src_path.write_text(instrumented_source)
    sysroot = sdk / "share" / "wasi-sysroot"
    cmd = [
        str(sdk / "bin" / "clang++"),
        "-std=c++17",
        f"--sysroot={sysroot}",
        f"-I{RUNTIME_DIR}",
        "-fno-exceptions",
        "-O1",
        "-Wall",
        "-Wextra",
        "-Wno-unused-parameter",
        # Exported explicitly: wasm-ld doesn't export arbitrary symbols by
        # default, and the browser worker (and this script's trap-recovery
        # path) needs to call these on a *trapped* instance — see
        # oocc_engine.hpp's file docstring on why the trace can't just rely
        # on the normal fd-1 write in that case.
        "-Wl,--export=oocc_trap_buffer_ptr",
        "-Wl,--export=oocc_trap_buffer_len",
        *(extra_args or []),
        str(src_path),
        "-o",
        str(out_wasm),
    ]
    return subprocess.run(cmd, check=True, capture_output=True, text=True)
