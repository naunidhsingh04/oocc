#ifdef OOCC_TRACE
#include "oocc_compiler/pipeline.hpp"

#include <sstream>

#include "oocc_compiler/compiler.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/lexer.hpp"
#include "oocc_compiler/parser.hpp"
#include "oocc_compiler/vm.hpp"

namespace oocc {

std::set<std::string> parse_emit_flag(const std::string& value) {
    std::set<std::string> stages;
    std::stringstream ss(value);
    std::string item;
    while (std::getline(ss, item, ',')) {
        if (item == "all") {
            stages.insert("tokens");
            stages.insert("ast");
            stages.insert("bytecode");
            stages.insert("trace");
        } else if (!item.empty()) {
            stages.insert(item);
        }
    }
    return stages;
}

json run_pipeline(const std::string& source, const std::set<std::string>& stages) {
    json out = json::object();

    std::vector<Token> tokens;
    try {
        Lexer lexer(source);
        tokens = lexer.scan_all();
        if (stages.count("tokens")) out["tokens"] = tokens_to_json(tokens);
    } catch (const OoccError& e) {
        out["error"] = error_to_json(e);
        return out;
    }

    std::unique_ptr<Program> program;
    try {
        Parser parser(tokens);
        program = parser.parse();
        if (stages.count("ast")) out["ast"] = ast_to_json(*program);
    } catch (const OoccError& e) {
        out["error"] = error_to_json(e);
        return out;
    }

    Chunk chunk;
    try {
        Compiler compiler;
        chunk = compiler.compile(*program);
        if (stages.count("bytecode")) out["bytecode"] = bytecode_to_json(chunk);
    } catch (const OoccError& e) {
        out["error"] = error_to_json(e);
        return out;
    }

    if (stages.count("trace")) {
        VM vm(chunk);
        try {
            std::string stdout_text = vm.run();
            out["trace"] = trace_to_json(vm.steps());
            out["stdout"] = stdout_text;
        } catch (const OoccError& e) {
            out["error"] = error_to_json(e);
            out["trace"] = trace_to_json(vm.steps());
        }
    }

    return out;
}

}  // namespace oocc

#endif  // OOCC_TRACE
