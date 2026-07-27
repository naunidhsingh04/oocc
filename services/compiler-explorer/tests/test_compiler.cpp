#include "catch.hpp"
#include "oocc_compiler/compiler.hpp"
#include "oocc_compiler/lexer.hpp"
#include "oocc_compiler/parser.hpp"

using namespace oocc;

namespace {
Chunk compile_source(const std::string& src) {
    Lexer lex(src);
    Parser parser(lex.scan_all());
    auto program = parser.parse();
    Compiler compiler;
    return compiler.compile(*program);
}
}  // namespace

TEST_CASE("every emitted instruction carries a valid astId", "[compiler]") {
    Chunk chunk = compile_source("let x = 1 + 2 * 3;\nprint x;\nif (x > 0) { print 1; }");
    for (const auto& instr : chunk.instructions) {
        CHECK(instr.astId >= 0);
    }
}

TEST_CASE("precedence a + b * c compiles multiply before add", "[compiler]") {
    Chunk chunk = compile_source("let a = 1;\nlet b = 2;\nlet c = 3;\nprint a + b * c;");
    // Find the MUL and ADD opcodes; MUL's pc must precede ADD's pc.
    int mul_pc = -1, add_pc = -1;
    for (const auto& instr : chunk.instructions) {
        if (instr.opcode == OpCode::Mul) mul_pc = instr.pc;
        if (instr.opcode == OpCode::Add) add_pc = instr.pc;
    }
    REQUIRE(mul_pc >= 0);
    REQUIRE(add_pc >= 0);
    CHECK(mul_pc < add_pc);
}

TEST_CASE("while loop compiles to a backward LOOP jump", "[compiler]") {
    Chunk chunk = compile_source("let i = 0;\nwhile (i < 3) { i = i + 1; }");
    bool found_loop = false;
    for (const auto& instr : chunk.instructions) {
        if (instr.opcode == OpCode::Loop) {
            found_loop = true;
            REQUIRE(instr.operands.size() == 1);
            CHECK(instr.operands[0] < instr.pc);  // jumps backward
        }
    }
    CHECK(found_loop);
}

TEST_CASE("if/else compiles JUMP_IF_FALSE and JUMP with valid forward targets", "[compiler]") {
    Chunk chunk = compile_source("let x = 1;\nif (x > 0) { print 1; } else { print 2; }");
    for (const auto& instr : chunk.instructions) {
        if (instr.opcode == OpCode::JumpIfFalse || instr.opcode == OpCode::Jump) {
            REQUIRE(instr.operands.size() == 1);
            CHECK(instr.operands[0] > instr.pc);  // jumps forward
            CHECK(instr.operands[0] <= static_cast<int>(chunk.instructions.size()));
        }
    }
}

TEST_CASE("locals resolve to GET_LOCAL/SET_LOCAL, globals to GET_GLOBAL/SET_GLOBAL", "[compiler]") {
    Chunk chunk = compile_source("let g = 1;\n{ let l = 2; print l; }\nprint g;");
    bool saw_get_local = false, saw_get_global = false;
    for (const auto& instr : chunk.instructions) {
        if (instr.opcode == OpCode::GetLocal) saw_get_local = true;
        if (instr.opcode == OpCode::GetGlobal) saw_get_global = true;
    }
    CHECK(saw_get_local);
    CHECK(saw_get_global);
}

TEST_CASE("leaving a block scope pops each local declared inside it", "[compiler]") {
    Chunk chunk = compile_source("{ let a = 1; let b = 2; }\nprint 0;");
    int pop_count = 0;
    for (const auto& instr : chunk.instructions) {
        if (instr.opcode == OpCode::Pop) pop_count++;
    }
    // one POP per local (a, b) at scope exit, plus one POP for the
    // top-level `print 0;`'s ExprStmt-equivalent... print doesn't pop, so
    // just the two scope-exit pops are the floor.
    CHECK(pop_count >= 2);
}
