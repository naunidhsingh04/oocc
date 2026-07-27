#include "catch.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/lexer.hpp"
#include "oocc_compiler/parser.hpp"

using namespace oocc;

TEST_CASE("missing semicolon reports a ParseError pointing at the next token", "[errors]") {
    Lexer lex("let x = 1\nprint x;");
    auto tokens = lex.scan_all();
    Parser parser(tokens);
    bool threw = false;
    try {
        parser.parse();
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Parse);
        // the error should point at 'print' on line 2, not somewhere on line 1
        CHECK(e.span().line == 2);
    }
    CHECK(threw);
}

TEST_CASE("unterminated block reports a ParseError", "[errors]") {
    Lexer lex("if (1 < 2) { print 1;");
    auto tokens = lex.scan_all();
    Parser parser(tokens);
    bool threw = false;
    try {
        parser.parse();
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Parse);
    }
    CHECK(threw);
}

TEST_CASE("every error carries a well-formed span (end >= start, line/col >= 1)", "[errors]") {
    Lexer lex("let x = #;");
    bool threw = false;
    try {
        lex.scan_all();
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.span().end >= e.span().start);
        CHECK(e.span().line >= 1);
        CHECK(e.span().column >= 1);
    }
    CHECK(threw);
}
