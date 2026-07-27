"""Tests for cpp_executor.compile_service — real wasi-sdk compiles (slow:
a handful of real subprocess invocations, not mocked), verifying the
source_hash cache and the untraced-fallback path actually work end to end."""

from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from cpp_executor.compile_service import compile_source, compile_untraced  # noqa: E402
from cpp_executor.toolchain import WASI_SDK_DIR, ToolchainNotFoundError  # noqa: E402

pytestmark = pytest.mark.skipif(
    not WASI_SDK_DIR.exists(),
    reason="wasi-sdk not installed at .toolchains/ — see services/cpp-executor/README.md",
)

SIMPLE_SOURCE = """
int main() {
    int x = 2 + 2;
    return 0;
}
"""

LAMBDA_SOURCE = """
int main() {
    auto f = []() { return 1; };
    return f();
}
"""


@pytest.fixture()
def cache_dir(tmp_path: Path) -> Path:
    return tmp_path / "cache"


def test_cold_compile_produces_wasm_bytes(cache_dir: Path):
    result = compile_source(SIMPLE_SOURCE, cache_dir=cache_dir)
    assert result.ok, result.diagnostics
    assert not result.from_cache
    assert result.wasm_bytes is not None
    assert result.wasm_bytes[:4] == b"\x00asm"  # WASM magic number


def test_warm_compile_hits_cache_and_is_fast(cache_dir: Path):
    first = compile_source(SIMPLE_SOURCE, cache_dir=cache_dir)
    assert first.ok and not first.from_cache

    start = time.monotonic()
    second = compile_source(SIMPLE_SOURCE, cache_dir=cache_dir)
    elapsed = time.monotonic() - start

    assert second.ok
    assert second.from_cache
    assert second.wasm_bytes == first.wasm_bytes
    # §3.5's "warm ~0ms" target — a cache hit is a file read, not a
    # subprocess spawn; generous bound to stay non-flaky under load.
    assert elapsed < 0.5


def test_unsupported_construct_offers_untraced_fallback(cache_dir: Path):
    result = compile_source(LAMBDA_SOURCE, cache_dir=cache_dir)
    assert not result.ok
    assert result.untraced_offer is True
    assert any(d.kind == "unsupported_construct" for d in result.diagnostics)

    fallback = compile_untraced(LAMBDA_SOURCE, cache_dir=cache_dir)
    assert fallback.ok, fallback.diagnostics
    assert fallback.wasm_bytes[:4] == b"\x00asm"


def test_concurrent_cold_compiles_of_the_same_source_dont_corrupt_each_other(cache_dir: Path):
    # compile_source used to write into a hash-derived (not per-call
    # unique) temp filename — two concurrent requests for the *same*
    # uncached source would both compile into that identical temp path
    # and race each other's write/rename. Real threads, real subprocess
    # compiles, not mocked: if the race were still there, this would
    # intermittently produce truncated/corrupt wasm bytes or a read/rename
    # error under contention.
    #
    # This test also caught two things that turned out not to be bugs,
    # worth recording so they aren't "fixed" again by mistake: (1) an
    # earlier version passed a caller-supplied `run_id` here and asserted
    # byte-identical output — a *different* run_id per concurrent call
    # produced *different* wasm bytes for identical source, which was a
    # real bug (a cache hit silently returned whatever run_id the first
    # caller happened to compile with) but is fixed by removing run_id
    # from compile_source entirely, not by this test. (2) even with that
    # fixed, wasi-sdk's clang embeds the *output filename* into the wasm
    # "name" custom section — since each call uses a unique tempfile name
    # (the actual race fix above), the resulting bytes still legitimately
    # differ per call in that one inert metadata section. Neither is a
    # correctness issue: the section doesn't affect execution semantics,
    # so this test checks for corruption/consistency, not byte equality.
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(compile_source, SIMPLE_SOURCE, cache_dir=cache_dir) for _ in range(4)
        ]
        results = [f.result() for f in futures]

    for r in results:
        assert r.ok, r.diagnostics
        # A complete, non-truncated module, not a partial/mixed write.
        assert r.wasm_bytes[:4] == b"\x00asm"

    # Whichever compile won the rename race, the cache must now hold
    # exactly one complete, valid entry — re-fetching (a guaranteed cache
    # hit, since all 4 compiles are long done) must return one of the
    # exact byte strings one of the 4 calls actually produced, not some
    # corrupted mix of two writes.
    refetch = compile_source(SIMPLE_SOURCE, cache_dir=cache_dir)
    assert refetch.ok and refetch.from_cache
    assert refetch.wasm_bytes in {r.wasm_bytes for r in results}


def test_toolchain_missing_raises_specific_error(cache_dir: Path, monkeypatch: pytest.MonkeyPatch):
    import cpp_executor.toolchain as toolchain_module

    monkeypatch.setattr(toolchain_module, "WASI_SDK_DIR", Path("/nonexistent/wasi-sdk"))
    with pytest.raises(ToolchainNotFoundError, match="wasi-sdk not found"):
        toolchain_module._require_sdk()
