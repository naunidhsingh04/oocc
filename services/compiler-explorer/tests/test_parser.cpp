#include "catch.hpp"
#include "oocc_compiler/ast.hpp"
#include "oocc_compiler/errors.hpp"
#include "oocc_compiler/lexer.hpp"
#include "oocc_compiler/parser.hpp"

using namespace oocc;

namespace {
std::unique_ptr<Program> parse(const std::string& src) {
    Lexer lex(src);
    Parser parser(lex.scan_all());
    return parser.parse();
}
}  // namespace

TEST_CASE("parser gives operator precedence: a + b * c nests the multiply", "[parser]") {
    auto program = parse("print a + b * c;");
    REQUIRE(program->statements.size() == 1);
    auto* print_stmt = static_cast<PrintStmt*>(program->statements[0].get());
    auto* top = static_cast<BinaryExpr*>(print_stmt->value.get());
    CHECK(top->op == TokenType::Plus);
    CHECK(top->left->kind == ExprKind::Variable);
    REQUIRE(top->right->kind == ExprKind::Binary);
    auto* rhs = static_cast<BinaryExpr*>(top->right.get());
    CHECK(rhs->op == TokenType::Star);
}

TEST_CASE("parser gives (a + b) * c a flipped shape from a + b * c", "[parser]") {
    auto program = parse("print (a + b) * c;");
    auto* print_stmt = static_cast<PrintStmt*>(program->statements[0].get());
    auto* top = static_cast<BinaryExpr*>(print_stmt->value.get());
    CHECK(top->op == TokenType::Star);
    REQUIRE(top->left->kind == ExprKind::Binary);
    auto* lhs = static_cast<BinaryExpr*>(top->left.get());
    CHECK(lhs->op == TokenType::Plus);
}

TEST_CASE("parser assigns stable, monotonically increasing node ids", "[parser]") {
    auto program = parse("let x = 1;\nlet y = 2;");
    CHECK(program->id == 0);
    auto* let_x = static_cast<LetStmt*>(program->statements[0].get());
    auto* let_y = static_cast<LetStmt*>(program->statements[1].get());
    // ids strictly increase in construction (source) order
    CHECK(let_x->id > program->id);
    CHECK(let_x->init->id > let_x->id);
    CHECK(let_y->id > let_x->init->id);
}

TEST_CASE("parser node spans cover their exact source substring", "[parser]") {
    std::string src = "let total = 7;";
    auto program = parse(src);
    auto* let_stmt = static_cast<LetStmt*>(program->statements[0].get());
    // init expr "7" is at byte offset 12..13
    CHECK(src.substr(let_stmt->init->span.start,
                      let_stmt->init->span.end - let_stmt->init->span.start) == "7");
    // whole `let` statement spans from 'l' to the trailing ';'
    CHECK(src.substr(let_stmt->span.start, let_stmt->span.end - let_stmt->span.start) ==
          "let total = 7;");
}

TEST_CASE("parser parses if/else and while with block bodies", "[parser]") {
    auto program = parse("if (x < 1) { print 1; } else { print 2; }\nwhile (x < 1) { x = x + 1; }");
    REQUIRE(program->statements.size() == 2);
    CHECK(program->statements[0]->kind == StmtKind::If);
    auto* if_stmt = static_cast<IfStmt*>(program->statements[0].get());
    REQUIRE(if_stmt->else_branch != nullptr);
    CHECK(program->statements[1]->kind == StmtKind::While);
}

TEST_CASE("parser throws a structured ParseError with a span on bad syntax", "[parser]") {
    bool threw = false;
    try {
        parse("let = 1;");
    } catch (const OoccError& e) {
        threw = true;
        CHECK(e.stage() == ErrorStage::Parse);
        CHECK(e.span().start >= 0);
    }
    CHECK(threw);
}
