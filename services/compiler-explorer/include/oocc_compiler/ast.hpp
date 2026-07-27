#pragma once
#include <memory>
#include <string>
#include <vector>

#include "oocc_compiler/span.hpp"
#include "oocc_compiler/token.hpp"

// The AST. This header is core structure only — no JSON, no #ifdef
// OOCC_TRACE anywhere in this file. Every node carries a stable `id`
// (assigned once, in construction order, by the parser) and a `span`
// (byte start/end into the source). Those two fields are the load-bearing
// link the whole explorer depends on: the compiler stamps each bytecode
// instruction with the id of the node that produced it, and the frontend
// walks id -> span -> source characters to cross-highlight all five panes.
// See ast_json.hpp/.cpp (guarded by OOCC_TRACE) for how nodes become JSON.
namespace oocc {

enum class ExprKind { Number, Bool, Variable, Unary, Binary, Assign };
enum class StmtKind { Let, Print, If, While, Block, ExprStmt };

struct Node {
    int id = 0;
    Span span;
    virtual ~Node() = default;
};

struct Expr : Node {
    ExprKind kind;
};

struct Stmt : Node {
    StmtKind kind;
};

struct NumberExpr : Expr {
    double value = 0.0;
    NumberExpr() { kind = ExprKind::Number; }
};

struct BoolExpr : Expr {
    bool value = false;
    BoolExpr() { kind = ExprKind::Bool; }
};

struct VariableExpr : Expr {
    std::string name;
    VariableExpr() { kind = ExprKind::Variable; }
};

struct UnaryExpr : Expr {
    TokenType op;
    std::unique_ptr<Expr> operand;
    UnaryExpr() { kind = ExprKind::Unary; }
};

struct BinaryExpr : Expr {
    TokenType op;
    std::unique_ptr<Expr> left;
    std::unique_ptr<Expr> right;
    BinaryExpr() { kind = ExprKind::Binary; }
};

struct AssignExpr : Expr {
    std::string name;
    std::unique_ptr<Expr> value;
    AssignExpr() { kind = ExprKind::Assign; }
};

struct LetStmt : Stmt {
    std::string name;
    std::unique_ptr<Expr> init;
    LetStmt() { kind = StmtKind::Let; }
};

struct PrintStmt : Stmt {
    std::unique_ptr<Expr> value;
    PrintStmt() { kind = StmtKind::Print; }
};

struct ExprStmt : Stmt {
    std::unique_ptr<Expr> expr;
    ExprStmt() { kind = StmtKind::ExprStmt; }
};

struct BlockStmt : Stmt {
    std::vector<std::unique_ptr<Stmt>> statements;
    BlockStmt() { kind = StmtKind::Block; }
};

struct IfStmt : Stmt {
    std::unique_ptr<Expr> condition;
    std::unique_ptr<BlockStmt> then_branch;
    std::unique_ptr<BlockStmt> else_branch;  // nullable
    IfStmt() { kind = StmtKind::If; }
};

struct WhileStmt : Stmt {
    std::unique_ptr<Expr> condition;
    std::unique_ptr<BlockStmt> body;
    WhileStmt() { kind = StmtKind::While; }
};

// The parse result: a synthetic root over the top-level statement list.
// It gets node id 0 so every emitted instruction, even one with no more
// specific AST origin (e.g. a synthetic implicit-HALT), has a valid astId
// to point at, per the brief's "module/program-level synthetic
// instructions can point at the program's root AST node id."
struct Program : Node {
    std::vector<std::unique_ptr<Stmt>> statements;
};

}  // namespace oocc
