#pragma once

namespace oocc {

// The instruction set for the stack VM. Every opcode either pushes,
// pops, or replaces values on an operand stack; control flow is two
// forward jumps and one backward jump, exactly enough to lower `if` and
// `while` (see compiler.cpp's emit_if / emit_while).
enum class OpCode {
    Const,          // operand: constant-pool index (number literal)      -> push
    True,           //                                                     -> push true
    False,          //                                                     -> push false
    Pop,            // discard top of stack (statement results, block-scope exit)
    DefineGlobal,   // operand: constant-pool index (name string); pops initializer
    GetGlobal,      // operand: constant-pool index (name string)        -> push
    SetGlobal,      // operand: constant-pool index (name string); peeks top
    GetLocal,       // operand: stack slot                                -> push
    SetLocal,       // operand: stack slot; peeks top
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Negate,
    Not,
    Equal,
    NotEqual,
    Greater,
    GreaterEqual,
    Less,
    LessEqual,
    Print,          // pops and writes one line to stdout
    Jump,           // operand: absolute pc                                unconditional
    JumpIfFalse,    // operand: absolute pc; peeks (does not pop) top
    Loop,           // operand: absolute pc (always backward)              unconditional
    Halt,
};

const char* opcode_name(OpCode op);

// Number of operand slots (0 or 1) each opcode's instruction carries.
// Every opcode used here has at most one operand, keeping the bytecode
// format uniform: {pc, opcode, operands: number[], ...}.
int opcode_operand_count(OpCode op);

}  // namespace oocc
