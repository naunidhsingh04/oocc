#pragma once
#include <string>
#include <vector>

#include "oocc_compiler/opcode.hpp"
#include "oocc_compiler/span.hpp"

namespace oocc {

// One emitted instruction. `pc` is simply this instruction's index in
// Chunk::instructions — every opcode here is fixed-width (0 or 1 operand
// slot), so there is no separate byte-offset/pc distinction to track.
//
// `astId` is not optional metadata: it is the id of the AST node that
// produced this instruction, and is what lets the explorer highlight the
// AST node (and, transitively, the source span and tokens) when the user
// hovers this instruction. Every instruction must carry one; synthetic
// module-level instructions (e.g. the trailing HALT) point at the
// program's root AST node id (always 0).
//
// `span` duplicates the originating node's source span (not just `line`)
// so a runtime error raised while executing this instruction can report a
// precise span without the VM needing to walk back into the AST.
struct Instruction {
    int pc = 0;
    OpCode opcode = OpCode::Halt;
    std::vector<int> operands;  // 0 or 1 entries; see opcode_operand_count
    int line = 0;
    Span span;
    std::string comment;  // human-readable, e.g. "push constant 3.14"
    int astId = 0;
};

struct Chunk {
    std::vector<Instruction> instructions;
    std::vector<double> constants;   // number literal pool, indexed by CONST operand
    std::vector<std::string> names;  // global/local name pool, indexed by *_GLOBAL operand
};

}  // namespace oocc
