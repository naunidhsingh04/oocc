#pragma once
// Everything in this header only exists when OOCC_TRACE is defined. It is
// the one place JSON-emission concerns live, kept out of lexer.*, parser.*,
// compiler.*, vm.* entirely (those files only ever touch this header
// behind their own #ifdef OOCC_TRACE guards, e.g. vm.hpp's `steps()`).
// A release build compiled with -DOOCC_TRACE=OFF never sees a single line
// of this file's contents — trace.cpp becomes an empty translation unit.
#ifdef OOCC_TRACE

#include <string>
#include <unordered_map>
#include <vector>

#include "oocc_compiler/ast.hpp"
#include "oocc_compiler/chunk.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/opcode.hpp"
#include "oocc_compiler/token.hpp"
#include "oocc_compiler/value.hpp"
#include "nlohmann/json.hpp"

namespace oocc {

using json = nlohmann::ordered_json;

// One executed instruction's before/after state. Populated by vm.cpp's
// run() loop, one per instruction executed (loops therefore produce one
// VmStep per iteration per instruction inside them — this is what lets
// the ribbon show "12 visible repeating blocks" for a 12-iteration loop,
// mirroring the trace ribbon concept from the main product's PRD §6.3).
struct VmStep {
    int pc = 0;
    OpCode opcode = OpCode::Halt;
    std::vector<Value> stack_before;
    std::vector<Value> stack_after;
    std::unordered_map<std::string, Value> globals;
    std::string stdout_delta;
};

json span_to_json(const Span& span);
json token_to_json(const Token& token);
json tokens_to_json(const std::vector<Token>& tokens);

json ast_to_json(const Program& program);
json ast_node_to_json(const Node& node);

json instruction_to_json(const Instruction& instr);
json bytecode_to_json(const Chunk& chunk);

json value_to_json(const Value& value);
json vm_step_to_json(const VmStep& step);
json trace_to_json(const std::vector<VmStep>& steps);

json error_to_json(const OoccError& error);

}  // namespace oocc

#endif  // OOCC_TRACE
