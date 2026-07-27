// Native CLI for the OOCC compiler explorer. Usage:
//
//   oocc_compiler --emit=tokens|ast|bytecode|trace|all[,...] <source-file>
//
// Prints one JSON object to stdout with a key per requested stage
// (`tokens`, `ast`, `bytecode`, `trace`, and — when trace was requested —
// `stdout` holding the program's actual printed output). `all` is
// shorthand for every stage. On lex/parse/runtime failure, prints
// {"error": {...}} (plus whatever earlier stages already succeeded) and
// exits 1.
//
// All the actual work happens in oocc::run_pipeline() (pipeline.hpp/.cpp)
// so this file and wasm/bindings.cpp are both thin callers of the exact
// same function — that is what makes native/WASM byte-identical output a
// property of the code rather than something we have to keep in sync by
// hand.
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#ifdef OOCC_TRACE
#include "oocc_compiler/pipeline.hpp"
#endif

namespace {

std::string read_file(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in) throw std::runtime_error("cannot open file: " + path);
    std::ostringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

}  // namespace

int main(int argc, char** argv) {
    std::string emit_value = "all";
    std::string path;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.rfind("--emit=", 0) == 0) {
            emit_value = arg.substr(std::string("--emit=").size());
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "usage: oocc_compiler --emit=tokens|ast|bytecode|trace|all <file>\n";
            return 0;
        } else {
            path = arg;
        }
    }

    if (path.empty()) {
        std::cerr << "error: no source file given\n";
        std::cerr << "usage: oocc_compiler --emit=tokens|ast|bytecode|trace|all <file>\n";
        return 2;
    }

#ifndef OOCC_TRACE
    (void)emit_value;
    std::cerr << "{\"error\":\"trace emission disabled in this build (compiled with "
                 "OOCC_TRACE=OFF)\"}\n";
    return 1;
#else
    std::string source;
    try {
        source = read_file(path);
    } catch (const std::exception& e) {
        std::cout << oocc::json{{"error", {{"stage", "IOError"}, {"message", e.what()}}}}.dump(2)
                  << std::endl;
        return 1;
    }

    auto stages = oocc::parse_emit_flag(emit_value);
    oocc::json out = oocc::run_pipeline(source, stages);
    std::cout << out.dump(2) << std::endl;
    return out.contains("error") ? 1 : 0;
#endif
}
