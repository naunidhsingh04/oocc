#include "catch.hpp"
#include "oocc_compiler/compiler.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/lexer.hpp"
#include "oocc_compiler/parser.hpp"
#include "oocc_compiler/vm.hpp"

using namespace oocc;

namespace {
std::string run_source(const std::string& src) {
    Lexer lex(src);
    Parser parser(lex.scan_all());
    auto program = parser.parse();
    Compiler compiler;
    Chunk chunk = compiler.compile(*program);
    VM vm(chunk);
    return vm.run();
}
}  // namespace

TEST_CASE("a + b * c respects multiplication-before-addition at runtime", "[vm]") {
    CHECK(run_source("print 2 + 3 * 4;") == "14\n");
    CHECK(run_source("print (2 + 3) * 4;") == "20\n");
}

TEST_CASE("comparisons and equality produce booleans", "[vm]") {
    CHECK(run_source("print 3 < 5;") == "true\n");
    CHECK(run_source("print 3 >= 5;") == "false\n");
    CHECK(run_source("print 3 == 3;") == "true\n");
    CHECK(run_source("print 3 != 3;") == "false\n");
}

TEST_CASE("while loop lowers to jumps and iterates the right number of times", "[vm]") {
    std::string out = run_source(
        "let i = 0;\n"
        "while (i < 5) {\n"
        "  print i;\n"
        "  i = i + 1;\n"
        "}");
    CHECK(out == "0\n1\n2\n3\n4\n");
}

TEST_CASE("if/else takes the correct branch", "[vm]") {
    CHECK(run_source("if (1 < 2) { print 1; } else { print 2; }") == "1\n");
    CHECK(run_source("if (1 > 2) { print 1; } else { print 2; }") == "2\n");
}

TEST_CASE("block scoping: an inner local does not leak, and shadows the outer", "[vm]") {
    std::string out = run_source(
        "let x = 1;\n"
        "{\n"
        "  let x = 2;\n"
        "  print x;\n"
        "}\n"
        "print x;");
    CHECK(out == "2\n1\n");
}

TEST_CASE("assignment mutates a global and is visible on next read", "[vm]") {
    CHECK(run_source("let x = 1;\nx = x + 41;\nprint x;") == "42\n");
}

TEST_CASE("division by zero raises a structured runtime error", "[vm]") {
    bool threw = false;
    try {
        run_source("print 1 / 0;");
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Runtime);
    }
    CHECK(threw);
}

TEST_CASE("reading an undefined global raises a structured runtime error", "[vm]") {
    bool threw = false;
    try {
        run_source("print undefined_name;");
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Runtime);
        CHECK(e.span().start >= 0);
    }
    CHECK(threw);
}

TEST_CASE("unary negation and logical not", "[vm]") {
    CHECK(run_source("print -5;") == "-5\n");
    CHECK(run_source("print !true;") == "false\n");
    CHECK(run_source("print !(1 < 2);") == "false\n");
}

TEST_CASE("modulo operator", "[vm]") {
    CHECK(run_source("print 10 % 3;") == "1\n");
}
