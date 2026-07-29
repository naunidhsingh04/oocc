"""The compile service (PRD §3.5 build step 6): source -> instrumented
wasm, cached by source_hash. This is "the server compiles; it does not run
user code" in concrete form — `compile_source` never executes the wasm it
produces, only clang.

Targets from §3.5: cold compile ≤2s p95, warm (cache hit) ~0ms. The cache
here is a flat directory keyed by source_hash, checked before touching
clang at all — a cache hit is a single file read, not a subprocess spawn,
so it trivially clears the "warm ~0ms" bar. Promoting this to a shared
Redis-backed cache (matching apps/api/app/cache.py's pattern for the
Python deterministic-analysis cache) is future infra work once this sits
behind a real endpoint, not a behavior change — same reasoning
app/cache.py's own docstring gives for its process-local dict.

Also implements the teaching-subset fallback (§3.5 build step 4): when
`instrument()` reports an unsupported construct, `compile_untraced` compiles
the user's original source directly (no runtime, no injected calls) so the
caller can still offer "run it anyway, just without step data" instead of
an outright refusal.

`run_id` is deliberately NOT a parameter here, and not something baked into
the cached wasm at all: instrument()'s generated `kRunMetaPrefix` embeds a
fixed placeholder (PLACEHOLDER_RUN_ID) instead of a caller-supplied value.
An earlier version took `run_id` as a parameter and threaded it through to
`instrument()` — which silently did nothing on a cache hit, since the
returned bytes were compiled (and had a run_id baked in) by a *previous*
call, possibly for a different logical run of the identical source.
Confirmed for real by a concurrency test: two concurrent compiles of the
same source with different run_ids produced wasm with two different
embedded run_ids, neither of which was reliably "the" run_id either caller
asked for. Since compilation is cacheable by source_hash alone but a
run_id is inherently per-*execution* (many runs can share one compiled
artifact), the two don't belong in the same cache key at all — the
executor (whoever instantiates and runs this wasm, e.g. the browser worker
or fixtures/cpp/generate.py) must overwrite `trace["run_id"]` in the
resulting JSON with a freshly generated one after execution, the same way
it already computes real per-run values like `meta.duration_ms`.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from .instrument import MAX_SOURCE_BYTES, Diagnostic, instrument_isolated, source_hash
from .toolchain import _require_sdk, compile_to_wasm, wasi_clang_args

DEFAULT_CACHE_DIR = Path(__file__).resolve().parents[1] / ".compile_cache"

# Matches trace.schema.json's HeapRef-adjacent run_id pattern (^r_[A-Za-z0-9]+$).
# Never meant to reach a real trace — see the module docstring on why
# run_id is assigned at execution time, not compile time.
PLACEHOLDER_RUN_ID = "r_pendingexecution0"


@dataclass
class CompileResult:
    ok: bool
    wasm_bytes: bytes | None = None
    from_cache: bool = False
    diagnostics: list[Diagnostic] = field(default_factory=list)
    untraced_offer: bool = False  # True when ok is False solely because of an unsupported construct


def _cache_path(cache_dir: Path, hash_: str, suffix: str) -> Path:
    return cache_dir / f"{hash_.replace(':', '_')}{suffix}"


def compile_source(
    source: str,
    *,
    cache_dir: Path = DEFAULT_CACHE_DIR,
) -> CompileResult:
    hash_ = source_hash(source)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = _cache_path(cache_dir, hash_, ".wasm")
    if cached.exists():
        return CompileResult(ok=True, wasm_bytes=cached.read_bytes(), from_cache=True)

    result = instrument_isolated(
        source, run_id=PLACEHOLDER_RUN_ID, extra_clang_args=wasi_clang_args()
    )
    if not result.ok:
        untraced_offer = bool(result.diagnostics) and all(
            d.kind == "unsupported_construct" for d in result.diagnostics
        )
        return CompileResult(
            ok=False, diagnostics=result.diagnostics, untraced_offer=untraced_offer
        )
    # InstrumentResult isn't a discriminated union at the type level, but
    # every `ok=True` construction site (instrument.py) always sets this —
    # asserted, not just assumed, so a future call site that breaks the
    # invariant fails loudly here instead of passing None into a subprocess
    # command line several frames downstream.
    assert result.instrumented_source is not None

    # A unique-per-call temp path, not a hash-derived deterministic one:
    # two concurrent requests for the *same* source would otherwise both
    # compile into the identical temp filename and race each other's
    # writes. os.replace (atomic on POSIX) means whichever finishes last
    # simply wins the rename — since both would produce byte-identical
    # output for the same source, the final cached file is correct either
    # way; this only avoids the two processes corrupting each other's
    # in-flight temp file. A real concern for a future concurrent-serving
    # endpoint, not for today's single-call test/fixture-generation usage.
    fd, tmp_name = tempfile.mkstemp(dir=cache_dir, suffix=".tmp.wasm")
    os.close(fd)
    out_wasm = Path(tmp_name)
    try:
        proc = compile_to_wasm(result.instrumented_source, out_wasm)
    except subprocess.TimeoutExpired:
        out_wasm.unlink(missing_ok=True)
        out_wasm.with_suffix(".instrumented.cpp").unlink(missing_ok=True)
        return CompileResult(
            ok=False,
            diagnostics=[
                Diagnostic(kind="compile_error", message="Compilation timed out after 30s.")
            ],
        )
    if proc.returncode != 0:
        out_wasm.unlink(missing_ok=True)
        out_wasm.with_suffix(".instrumented.cpp").unlink(missing_ok=True)
        return CompileResult(
            ok=False,
            diagnostics=[Diagnostic(kind="compile_error", message=proc.stderr)],
        )

    wasm_bytes = out_wasm.read_bytes()
    os.replace(out_wasm, cached)
    out_wasm.with_suffix(".instrumented.cpp").unlink(missing_ok=True)
    return CompileResult(ok=True, wasm_bytes=wasm_bytes, from_cache=False)


def compile_untraced(source: str, *, cache_dir: Path = DEFAULT_CACHE_DIR) -> CompileResult:
    """Compiles the user's original source as plain wasm32-wasi — no
    runtime, no injected calls, no trace. Callers use this after
    compile_source reports untraced_offer=True and the user accepts running
    without step data (PRD §3.5: "Offer to run it untraced rather than
    refusing.").

    Enforces the same size cap `instrument()` does (SECURITY.md, Phase 6
    security review), independently: this is a separate public entrypoint,
    not exclusively reachable through `compile_source`'s own check, and
    clang++ itself has no source-size guard of its own — only a subprocess
    timeout (toolchain.py's `compile_to_wasm`; this function's own subprocess
    call has the identical timeout for the identical reason).
    """
    if len(source.encode("utf-8", errors="surrogatepass")) > MAX_SOURCE_BYTES:
        return CompileResult(
            ok=False,
            diagnostics=[
                Diagnostic(
                    kind="resource_limit",
                    message=(
                        f"This program is larger than OOCC's {MAX_SOURCE_BYTES:,}-byte "
                        "teaching-subset limit and can't be compiled."
                    ),
                )
            ],
        )

    hash_ = source_hash(source) + ":untraced"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached = _cache_path(cache_dir, hash_, ".wasm")
    if cached.exists():
        return CompileResult(ok=True, wasm_bytes=cached.read_bytes(), from_cache=True)

    # Unique-per-call temp path — same concurrent-request reasoning as
    # compile_source above.
    fd, tmp_name = tempfile.mkstemp(dir=cache_dir, suffix=".tmp.wasm")
    os.close(fd)
    out_wasm = Path(tmp_name)
    src_path = out_wasm.with_suffix(".cpp")
    src_path.write_text(source)

    sdk = _require_sdk()

    try:
        # timeout=: this compiles the user's *original*, uninstrumented
        # source directly — none of instrument()'s own parse-time diagnostics
        # (deep-template rejection included) run on this path, so a
        # pathological source that reaches here via the "run it untraced"
        # offer has nothing else standing between it and an indefinitely
        # hung clang++ (see SECURITY.md, Phase 6 security review).
        proc = subprocess.run(
            [
                str(sdk / "bin" / "clang++"),
                "-std=c++17",
                f"--sysroot={sdk / 'share' / 'wasi-sysroot'}",
                "-O1",
                str(src_path),
                "-o",
                str(out_wasm),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        src_path.unlink(missing_ok=True)
        out_wasm.unlink(missing_ok=True)
        return CompileResult(
            ok=False,
            diagnostics=[
                Diagnostic(kind="compile_error", message="Compilation timed out after 30s.")
            ],
        )
    src_path.unlink(missing_ok=True)
    if proc.returncode != 0:
        out_wasm.unlink(missing_ok=True)
        return CompileResult(
            ok=False, diagnostics=[Diagnostic(kind="compile_error", message=proc.stderr)]
        )

    wasm_bytes = out_wasm.read_bytes()
    os.replace(out_wasm, cached)
    return CompileResult(ok=True, wasm_bytes=wasm_bytes, from_cache=False)
