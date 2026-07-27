# services/cpp-executor

The C++ engine (docs/PRD.md §3.5, Phase 4): Clang source-to-source
instrumentation, compiled through wasi-sdk to WASM, executed in a browser
worker. See CLAUDE.md's "Phase 4 backend" section for the full design and
its deliberate deviations from the PRD's literal wording (libclang bindings
instead of C++ LibTooling; fd 1 instead of a dedicated fd 3 for the trace
channel).

## Layout

- `runtime/` — the C++ header-only runtime linked into every instrumented
  program: allocator interposition + address table (`oocc_runtime.hpp`),
  the Value/HeapObject JSON encoder (`oocc_trace.hpp`), STL pretty-printers
  (`oocc_stl_printers.hpp`), and the step/frame engine
  (`oocc_engine.hpp`).
- `cpp_executor/` — the Python package: `instrument.py` (the libclang
  pass), `toolchain.py` (wasi-sdk compile wrapper).
- `tests/native/` — native (non-WASM) C++ tests for the runtime, plus
  Python tests for the pass. Native compiles are far faster than a wasm
  round trip for iterating on the runtime itself; the wasm target is
  exercised separately (see tests/test_wasm_pipeline.py) to catch anything
  that's genuinely target-specific.

## One-time setup: wasi-sdk

No Homebrew formula exists for wasi-sdk. Download the prebuilt release and
extract it to `.toolchains/` at the repo root (gitignored — a ~500MB
extracted toolchain has no business in version control):

```sh
mkdir -p .toolchains && cd .toolchains
curl -sL -o wasi-sdk.tar.gz \
  https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-33/wasi-sdk-33.0-arm64-macos.tar.gz
tar xzf wasi-sdk.tar.gz && rm wasi-sdk.tar.gz
```

(Use the `x86_64-macos` or `*-linux` asset from the same release for other
hosts.) `cpp_executor/toolchain.py`'s `WASI_SDK_DIR` constant assumes this
exact path; update it there if you extract elsewhere.

## Regenerating the C++ fixtures

```sh
uv run --package oocc-cpp-executor python fixtures/cpp/generate.py
```
