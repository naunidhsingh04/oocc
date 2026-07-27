// Emscripten/Embind entry point. Exports a single `compile(source, emit)`
// function returning the same JSON text (as a UTF-8 string) that the
// native CLI's `--emit=` prints, by calling the exact same
// oocc::run_pipeline() the CLI calls (see pipeline.hpp) — the two are
// meant to be byte-identical (modulo the CLI's trailing newline from
// std::endl; see tools/compare_native_wasm.mjs for the normalization).
//
// This binding is a thin wrapper on purpose: get the native build 100%
// correct first, then the WASM side is "obviously correct" by inspection
// rather than something that needs its own logic to review.
#include <emscripten/bind.h>

#include "oocc_compiler/pipeline.hpp"

namespace {

std::string compile(const std::string& source, const std::string& emit) {
    auto stages = oocc::parse_emit_flag(emit.empty() ? "all" : emit);
    oocc::json out = oocc::run_pipeline(source, stages);
    return out.dump(2);
}

}  // namespace

EMSCRIPTEN_BINDINGS(oocc_compiler_explorer) {
    emscripten::function("compile", &compile);
}
