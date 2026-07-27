#pragma once
#include <memory>
#include <vector>

#include "oocc_compiler/ast.hpp"
#include "oocc_compiler/token.hpp"

namespace oocc {

// Recursive-descent parser, one function per grammar rule, standard
// precedence-climbing for expressions:
//
//   program    := statement* EOF
//   statement  := letDecl | printStmt | ifStmt | whileStmt | block | exprStmt
//   letDecl    := "let" IDENT "=" expression ";"
//   printStmt  := "print" expression ";"
//   ifStmt     := "if" "(" expression ")" block ( "else" block )?
//   whileStmt  := "while" "(" expression ")" block
//   block      := "{" statement* "}"
//   exprStmt   := expression ";"
//   expression := assignment
//   assignment := IDENT "=" assignment | equality
//   equality   := comparison (("==" | "!=") comparison)*
//   comparison := term (("<" | "<=" | ">" | ">=") term)*
//   term       := factor (("+" | "-") factor)*
//   factor     := unary (("*" | "/" | "%") unary)*
//   unary      := ("-" | "!") unary | primary
//   primary    := NUMBER | "true" | "false" | IDENT | "(" expression ")"
//
// Every node constructed here is assigned a stable, monotonically
// increasing id via next_id(), in construction order (root first). Throws
// OoccError(ErrorStage::Parse) with a source span on the first syntax
// error; does not attempt error recovery (one error is enough to explain
// to a learner, and multi-error recovery is out of scope for a ten-example
// teaching project).
class Parser {
public:
    explicit Parser(std::vector<Token> tokens);

    std::unique_ptr<Program> parse();

private:
    std::vector<Token> tokens_;
    int pos_ = 0;
    int next_id_ = 0;

    int next_id() { return next_id_++; }

    const Token& peek() const;
    const Token& previous() const;
    const Token& advance();
    bool check(TokenType type) const;
    bool match(TokenType type);
    const Token& expect(TokenType type, const std::string& message);
    bool at_end() const;

    std::unique_ptr<Stmt> statement();
    std::unique_ptr<LetStmt> let_declaration();
    std::unique_ptr<PrintStmt> print_statement();
    std::unique_ptr<IfStmt> if_statement();
    std::unique_ptr<WhileStmt> while_statement();
    std::unique_ptr<BlockStmt> block();
    std::unique_ptr<ExprStmt> expr_statement();

    std::unique_ptr<Expr> expression();
    std::unique_ptr<Expr> assignment();
    std::unique_ptr<Expr> equality();
    std::unique_ptr<Expr> comparison();
    std::unique_ptr<Expr> term();
    std::unique_ptr<Expr> factor();
    std::unique_ptr<Expr> unary();
    std::unique_ptr<Expr> primary();
};

}  // namespace oocc
