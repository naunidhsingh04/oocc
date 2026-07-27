#include "oocc_compiler/opcode.hpp"

namespace oocc {

const char* opcode_name(OpCode op) {
    switch (op) {
        case OpCode::Const:
            return "CONST";
        case OpCode::True:
            return "TRUE";
        case OpCode::False:
            return "FALSE";
        case OpCode::Pop:
            return "POP";
        case OpCode::DefineGlobal:
            return "DEFINE_GLOBAL";
        case OpCode::GetGlobal:
            return "GET_GLOBAL";
        case OpCode::SetGlobal:
            return "SET_GLOBAL";
        case OpCode::GetLocal:
            return "GET_LOCAL";
        case OpCode::SetLocal:
            return "SET_LOCAL";
        case OpCode::Add:
            return "ADD";
        case OpCode::Sub:
            return "SUB";
        case OpCode::Mul:
            return "MUL";
        case OpCode::Div:
            return "DIV";
        case OpCode::Mod:
            return "MOD";
        case OpCode::Negate:
            return "NEGATE";
        case OpCode::Not:
            return "NOT";
        case OpCode::Equal:
            return "EQUAL";
        case OpCode::NotEqual:
            return "NOT_EQUAL";
        case OpCode::Greater:
            return "GREATER";
        case OpCode::GreaterEqual:
            return "GREATER_EQUAL";
        case OpCode::Less:
            return "LESS";
        case OpCode::LessEqual:
            return "LESS_EQUAL";
        case OpCode::Print:
            return "PRINT";
        case OpCode::Jump:
            return "JUMP";
        case OpCode::JumpIfFalse:
            return "JUMP_IF_FALSE";
        case OpCode::Loop:
            return "LOOP";
        case OpCode::Halt:
            return "HALT";
    }
    return "UNKNOWN";
}

int opcode_operand_count(OpCode op) {
    switch (op) {
        case OpCode::Const:
        case OpCode::DefineGlobal:
        case OpCode::GetGlobal:
        case OpCode::SetGlobal:
        case OpCode::GetLocal:
        case OpCode::SetLocal:
        case OpCode::Jump:
        case OpCode::JumpIfFalse:
        case OpCode::Loop:
            return 1;
        default:
            return 0;
    }
}

}  // namespace oocc
