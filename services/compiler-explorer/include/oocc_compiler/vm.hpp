#pragma once
#include <string>
#include <unordered_map>
#include <vector>

#include "oocc_compiler/chunk.hpp"
#include "oocc_compiler/value.hpp"

#ifdef OOCC_TRACE
#include "oocc_compiler/trace.hpp"
#endif

namespace oocc {

// Opcode-driven stack VM. No call frames (the language has no functions),
// so there is exactly one flat operand stack; globals live in a name->Value
// map, locals live at fixed stack slots resolved at compile time.
//
// When OOCC_TRACE is defined, `run()` additionally records one VmStep per
// executed instruction (stack before/after, globals snapshot, stdout
// delta) via trace.hpp's VmStep — that bookkeeping is entirely compiled
// out otherwise, per the brief's "pays nothing" requirement for release
// builds.
class VM {
public:
    explicit VM(Chunk chunk);

    // Runs to completion (HALT) or throws OoccError(ErrorStage::Runtime)
    // with the span of the instruction that failed. Returns everything
    // written via `print`.
    std::string run();

#ifdef OOCC_TRACE
    const std::vector<VmStep>& steps() const { return steps_; }
#endif

private:
    Chunk chunk_;
    std::vector<Value> stack_;
    std::unordered_map<std::string, Value> globals_;
    std::string stdout_;
    int pc_ = 0;

#ifdef OOCC_TRACE
    std::vector<VmStep> steps_;
#endif

    Value pop();
    const Value& peek(int distance = 0) const;
    void push(const Value& v);
    [[noreturn]] void runtime_error(const Instruction& instr, const std::string& message);
};

}  // namespace oocc
