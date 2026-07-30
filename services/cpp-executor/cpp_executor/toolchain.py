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

`WASI_SDK_DIR`/`_CLANGPP_NAME` are resolved from the running OS, not
hardcoded to one platform: this used to point at a single
`wasi-sdk-33.0-arm64-macos` directory (the original dev sandbox's own
architecture), which silently made every C++ fixture ungeneratable on any
other machine — found for real setting this up on a Windows sandbox, where
the release asset is `wasi-sdk-33.0-x86_64-windows` and every binary needs
a `.exe` suffix. All internal layout below `WASI_SDK_DIR`
(`share/wasi-sysroot`, `lib/clang/<ver>`) is identical release-to-release
across platforms for the same wasi-sdk version, so only the directory name
and executable suffix vary — same reasoning `instrument.py`'s
`_bundled_libclang_path` already applies to libclang itself.
"""

from __future__ import annotations

import platform
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_DIR = REPO_ROOT / "services" / "cpp-executor" / "runtime"

_WASI_SDK_VERSION = "33.0"
_EXE_SUFFIX = ".exe" if platform.system() == "Windows" else ""


def _wasi_sdk_asset_name() -> str:
    system = platform.system()
    machine = platform.machine().lower()
    arch = "arm64" if machine in ("arm64", "aarch64") else "x86_64"
    if system == "Darwin":
        return f"wasi-sdk-{_WASI_SDK_VERSION}-{arch}-macos"
    if system == "Windows":
        # wasi-sdk only ships an x86_64 Windows release, regardless of the
        # host's real architecture (there is no arm64-windows asset as of
        # this writing) — Windows on ARM runs x86_64 binaries under
        # emulation, so this is still correct there, just not native.
        return f"wasi-sdk-{_WASI_SDK_VERSION}-x86_64-windows"
    if system == "Linux":
        return f"wasi-sdk-{_WASI_SDK_VERSION}-{arch}-linux"
    raise ToolchainNotFoundError(f"No known wasi-sdk release asset for platform {system}/{machine}.")


WASI_SDK_DIR = REPO_ROOT / ".toolchains" / _wasi_sdk_asset_name()


class ToolchainNotFoundError(RuntimeError):
    pass


def _require_sdk() -> Path:
    if not WASI_SDK_DIR.exists():
        raise ToolchainNotFoundError(
            f"wasi-sdk not found at {WASI_SDK_DIR}. Download the "
            f"{_wasi_sdk_asset_name()}.tar.gz release tarball from "
            "https://github.com/WebAssembly/wasi-sdk/releases and extract it to .toolchains/ "
            "(no Homebrew/scoop/apt package exists for wasi-sdk as of this writing)."
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
) -> subprocess.CompletedProcess[str]:
    """Compiles already-instrumented C++ source to a wasm32-wasi module.
    `extra_args` is where callers pass memory-limit linker flags for the
    out-of-bounds-write fixture (see fixtures/cpp/programs/out_of_bounds_write.cpp)."""
    sdk = _require_sdk()
    src_path = out_wasm.with_suffix(".instrumented.cpp")
    src_path.write_text(instrumented_source)
    sysroot = sdk / "share" / "wasi-sysroot"
    cmd = [
        str(sdk / "bin" / f"clang++{_EXE_SUFFIX}"),
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
    # timeout=, not left unbounded: a pathological source (deep template
    # recursion, exponential instantiation) can make clang++ itself hang far
    # past any reasonable compile — found during Phase 6's security review
    # (SECURITY.md), which is also why this is a `subprocess.TimeoutExpired`
    # a caller must handle. 30s is generous headroom over §3.5's own "cold
    # compile ≤2s p95" target — a legitimate teaching-subset program is
    # nowhere near this.
    #
    # Not `check=True`: this function's only caller (compile_service.py's
    # compile_source) already inspects `proc.returncode` itself to build a
    # `CompileResult(ok=False, ...)` — `check=True` would raise
    # `CalledProcessError` on the very first failing compile instead of ever
    # reaching that branch, which is dead code as long as this stays True.
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30)
