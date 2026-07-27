#include "catch.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/lexer.hpp"

using namespace oocc;

TEST_CASE("lexer tokenizes a simple let statement", "[lexer]") {
    Lexer lex("let x = 42;");
    auto tokens = lex.scan_all();

    // let, x, =, 42, ;, EOF
    REQUIRE(tokens.size() == 6);
    CHECK(tokens[0].type == TokenType::Let);
    CHECK(tokens[1].type == TokenType::Ident);
    CHECK(tokens[1].lexeme == "x");
    CHECK(tokens[2].type == TokenType::Equal);
    CHECK(tokens[3].type == TokenType::Number);
    CHECK(tokens[3].lexeme == "42");
    CHECK(tokens[4].type == TokenType::Semicolon);
    CHECK(tokens[5].type == TokenType::Eof);
}

TEST_CASE("lexer records correct byte offsets", "[lexer]") {
    Lexer lex("let ab = 1;");
    auto tokens = lex.scan_all();
    // "let" at [0,3), "ab" at [4,6)
    CHECK(tokens[0].span.start == 0);
    CHECK(tokens[0].span.end == 3);
    CHECK(tokens[1].span.start == 4);
    CHECK(tokens[1].span.end == 6);
}

TEST_CASE("lexer tracks line and column across newlines", "[lexer]") {
    Lexer lex("let a = 1;\nlet b = 2;");
    auto tokens = lex.scan_all();
    // tokens: let(0) a(1) =(2) 1(3) ;(4) let(5) b(6) =(7) 2(8) ;(9) EOF(10)
    CHECK(tokens[0].span.line == 1);
    CHECK(tokens[5].span.line == 2);
    CHECK(tokens[5].span.column == 1);
}

TEST_CASE("lexer recognizes two-char operators distinctly from one-char", "[lexer]") {
    Lexer lex("a == b != c <= d >= e");
    auto tokens = lex.scan_all();
    CHECK(tokens[1].type == TokenType::EqualEqual);
    CHECK(tokens[3].type == TokenType::BangEqual);
    CHECK(tokens[5].type == TokenType::LessEqual);
    CHECK(tokens[7].type == TokenType::GreaterEqual);
}

TEST_CASE("lexer skips line comments", "[lexer]") {
    Lexer lex("let x = 1; // this is a comment\nprint x;");
    auto tokens = lex.scan_all();
    // no COMMENT token type should appear; just the two statements + EOF
    REQUIRE(tokens.size() == 5 + 4);  // let x = 1 ; print x ; EOF (9 tokens)
}

TEST_CASE("lexer throws a structured error with a span on an unknown character", "[lexer]") {
    Lexer lex("let x = 1 @ 2;");
    bool threw = false;
    try {
        lex.scan_all();
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Lex);
        CHECK(e.span().start == 10);
        CHECK(e.span().end == 11);
    }
    CHECK(threw);
}
