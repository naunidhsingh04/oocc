# services/compiler-explorer

The C++ pipeline behind `/compiler` (docs/PRD.md §7, Phase 5): a small,
hand-written teaching language — variables, arithmetic/comparison
expressions, `if`/`else`, `while`, `print` — taken through lexer ->
recursive-descent parser -> AST -> bytecode compiler -> stack VM, with
every stage able to emit JSON behind an `OOCC_TRACE` build flag.

This is a **different project** from `services/cpp-executor` (which
traces arbitrary user-submitted C++ for the Phase 4 execution-tracing
product) and from `services/executor` (the Python tracer). Nothing here
touches either of those.

## Why this exists

The explorer's whole point is letting a learner hover a bytecode
instruction and see, simultaneously, the AST node that produced it, that
node's token range, and the source characters underneath. The mechanism
for that is two fields carried on every emitted instruction:

- **`astId`** — the id of the AST node that produced this instruction.
  Every instruction has one; synthetic/module-level instructions (the
  trailing `HALT`) point at the program's root AST node id (always `0`).
- **`span`** (on tokens, AST nodes, and instructions alike) — a
  `{start, end, line, column}` byte range into the original source.

These aren't "nice to have" metadata bolted on afterward — they're
computed as part of parsing/compiling (see `include/oocc_compiler/ast.hpp`
and `compiler.cpp`) and are load-bearing for the whole cross-highlighting
feature.

## Layout

```
services/compiler-explorer/
├─ CMakeLists.txt          OOCC_TRACE option, native + emscripten targets
├─ CMakePresets.json        native-dev / native-release / wasm presets
├─ include/oocc_compiler/   public headers (core has zero JSON dependency)
│  ├─ span.hpp, token.hpp, ast.hpp, opcode.hpp, chunk.hpp, value.hpp
│  ├─ lexer.hpp, parser.hpp, compiler.hpp, vm.hpp   -- core, always compiled
│  ├─ errors.hpp            structured, span-carrying errors
│  ├─ trace.hpp             JSON emission -- entirely #ifdef OOCC_TRACE
│  └─ pipeline.hpp          source -> JSON driver shared by CLI and WASM
├─ src/                     implementations (mirrors include/)
├─ tools/
│  ├─ main.cpp               native CLI (--emit=...)
│  └─ compare_native_wasm.mjs  native/WASM byte-identical round-trip check
├─ wasm/bindings.cpp        Embind wrapper around pipeline.hpp
├─ examples/                ten .ooc programs (see examples/README.md)
├─ tests/                   Catch2 test suite (vendored, see third_party/)
└─ third_party/             vendored single-header deps (see below)
```

## The trace/core split

`trace.hpp`/`trace.cpp` and `pipeline.hpp`/`pipeline.cpp` are the *only*
files that touch JSON, and their entire contents are wrapped in
`#ifdef OOCC_TRACE`. `lexer.*`, `parser.*`, `compiler.*`, `vm.*` never
include a JSON library and never know whether tracing is on. When
`OOCC_TRACE` is off:

- `trace.cpp` and `pipeline.cpp` compile to empty translation units.
- `vm.hpp`'s `steps()` accessor and the `VmStep`-recording code inside
  `vm.cpp`'s `run()` loop disappear (also guarded by `#ifdef OOCC_TRACE`),
  so there's no per-instruction stack-copying cost either.
- The CLI (`tools/main.cpp`) still builds, but any `--emit=` request
  prints `{"error":"trace emission disabled in this build..."}` and exits
  1, since there is nothing left in the binary that can produce JSON.

This is the mechanism behind "OOCC_TRACE=OFF pays nothing" — it's not
just a CMake option existing, the preprocessor genuinely strips the code.

## Building (native)

Requires a C++17 compiler and CMake ≥ 3.16. Nothing else — the JSON
library (nlohmann/json, header-only) and the test framework (Catch2 v2,
single header) are vendored into `third_party/` so there's no package
manager dependency.

```sh
cmake --preset native-dev        # OOCC_TRACE=ON, for local dev/CI
cmake --build build

./build/oocc_compiler --emit=all examples/01_precedence.ooc
```

Release/production builds must turn tracing off:

```sh
cmake --preset native-release    # OOCC_TRACE=OFF
cmake --build build-release
```

### Tests

```sh
cmake --build build --target oocc_compiler_tests
./build/oocc_compiler_tests
```

(On Windows with the MinGW-w64 toolchain, make sure the compiler's `bin/`
directory — wherever `libstdc++-6.dll` etc. live — is on `PATH` when
running the resulting `.exe`s; CMake doesn't do this for you.)

## Building (WASM)

Requires the Emscripten SDK (`emcc`/`emcmake` on `PATH`). Uses a separate
build directory so it never collides with the native one:

```sh
emcmake cmake --preset wasm
cmake --build build-wasm
```

This produces `build-wasm/oocc_compiler.js` — a Node-targeted, single-file
(`SINGLE_FILE=1`, WASM inlined as base64) Embind module exporting one
function:

```js
const OOCCCompiler = require("./build-wasm/oocc_compiler.js");
const Module = await OOCCCompiler();
const json = Module.compile(sourceText, "all"); // same shape as the CLI
```

### Native/WASM round-trip check

```sh
node tools/compare_native_wasm.mjs \
  --native build/oocc_compiler \
  --wasm build-wasm/oocc_compiler.js \
  --examples examples
```

Diffs the native `--emit=all` output against the WASM `compile()` output
for every example, byte-for-byte (modulo the CLI's trailing newline from
`std::endl` — see the script's `normalize()`). Both paths call the exact
same `oocc::run_pipeline()` (`pipeline.hpp`), so this is really testing
"does the WASM target compile the same source to the same behavior,"
not two independently-written JSON emitters.

This is wired into CI as the `compiler-explorer` job in
`.github/workflows/ci.yml`, which installs emsdk fresh on the runner.

## The `--emit` flag

```
oocc_compiler --emit=tokens|ast|bytecode|trace|all[,...] <file>
```

Comma-separated stage names; `all` is shorthand for all four. Output is
one JSON object with one key per requested stage (`tokens`, `ast`,
`bytecode`, `trace`), plus `stdout` (the program's actual printed output)
whenever `trace` was requested. On lex/parse/runtime failure, prints
`{"error": {"stage", "message", "span"}}` — plus whatever earlier stages
already succeeded — and exits 1.

## Design decisions (things the brief left open)

- **Language surface**: numbers (double) and bools only — no strings,
  arrays, or functions. The brief's list is "variables, arithmetic/
  comparison expressions, conditionals, while loops, print"; anything
  beyond that (closures, recursion, collections) is out of scope for a
  ten-example teaching pipeline and would mean call frames, which the VM
  deliberately doesn't have.
- **Scoping model**: no functions means no call frames, so locals are
  resolved at compile time to fixed stack slots (clox-style) rather than
  needing a runtime environment chain. Globals are a name-keyed map,
  resolved by name at runtime (`GET_GLOBAL`/`SET_GLOBAL`); the compiler
  falls back to a global reference for any name that isn't a currently-
  in-scope local.
- **AST node id scheme**: a monotonically increasing counter in the
  parser, assigned in construction order (so the `Program` root is always
  id `0`, and ids increase left-to-right/outside-in as parsing proceeds).
  Not stable across re-parses of edited source — only within one parse.
- **Instruction operands**: modeled as `operands: number[]` (0 or 1
  entries) rather than a single optional int, so the JSON shape is
  uniform even though no opcode here needs more than one operand.
- **Error span format**: identical shape to AST node spans —
  `{start, end, line, column}` — so the frontend's span-to-highlight code
  doesn't need a separate code path for errors vs. AST nodes.
- **JSON field naming**: `camelCase` for the two explorer-specific fields
  (`astId`, `stackBefore`/`stackAfter`/`stdoutDelta`) to match how they'll
  likely cross a JS boundary; everything else (`pc`, `opcode`, `operands`,
  `line`, `comment`) is a plain lowercase word per the brief's own
  phrasing.
- **WASM export shape**: a single `compile(source, emit)` function via
  Embind returning a JSON string (rather than a bound C++ object graph),
  so the exact same string the CLI prints is what JS gets — no separate
  marshalling logic to keep in sync.

## Vendored third-party code

No network access is assumed at build time, so both dependencies are
vendored (not fetched by CMake):

- `third_party/nlohmann/json.hpp` — nlohmann/json, single header, MIT.
- `third_party/catch.hpp` — Catch2 v2.x, single header, BSL-1.0.

Both were fetched once (from `raw.githubusercontent.com`) while writing
this track and committed as-is; update by re-fetching the same URLs if a
newer version is ever needed.
