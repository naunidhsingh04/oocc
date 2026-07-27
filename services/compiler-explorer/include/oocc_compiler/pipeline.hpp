#pragma once
// Shared driver: source text -> {tokens?, ast?, bytecode?, trace?, stdout?,
// error?} JSON. Both tools/main.cpp (native CLI) and wasm/bindings.cpp
// (Embind) call exactly this function, so "native and WASM produce
// byte-identical output for the ten example programs" reduces to "this
// one function is deterministic," which it is — no wall-clock reads, no
// pointer-address-derived ids, nothing environment-dependent.
#ifdef OOCC_TRACE

#include <set>
#include <string>

#include "oocc_compiler/trace.hpp"

namespace oocc {

// Splits a comma-separated --emit value into stage names, expanding
// "all" to {tokens, ast, bytecode, trace}.
std::set<std::string> parse_emit_flag(const std::string& value);

// Runs the full lex -> parse -> compile -> (optionally) execute pipeline
// over `source`, returning only the keys named in `stages`. Never throws:
// lex/parse/runtime failures are caught internally and surface as an
// "error" key alongside whatever earlier stages already succeeded.
json run_pipeline(const std::string& source, const std::set<std::string>& stages);

}  // namespace oocc

#endif  // OOCC_TRACE
