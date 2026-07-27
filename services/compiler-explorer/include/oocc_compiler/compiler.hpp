#pragma once
#include <string>
#include <vector>

#include "oocc_compiler/ast.hpp"
#include "oocc_compiler/chunk.hpp"

namespace oocc {

// Lowers the AST to bytecode for the flat-stack VM. There are no function
// calls in this teaching language, so there is exactly one call frame ever
// (globals + a single local stack that grows/shrinks with block scope) —
// local variable slots are just stack positions, resolved at compile time
// clox-style: entering a block increments a scope depth, `let` inside a
// block pushes a compile-time (name, depth) record whose slot is its
// position in that record list, and leaving the block emits one POP per
// local that was live in it.
class Compiler {
public:
    Chunk compile(const Program& program);

private:
    Chunk chunk_;

    struct Local {
        std::string name;
        int depth;
    };
    std::vector<Local> locals_;
    int scope_depth_ = 0;
    int root_ast_id_ = 0;

    int emit(OpCode op, int ast_id, Span span, std::string comment, int operand = -1);
    int add_constant(double value);
    int add_name(const std::string& name);
    void patch_jump(int instruction_index, int target_pc);
    int resolve_local(const std::string& name) const;

    void begin_scope();
    void end_scope(int ast_id, Span span);

    void compile_stmt(const Stmt& stmt);
    void compile_let(const LetStmt& stmt);
    void compile_print(const PrintStmt& stmt);
    void compile_expr_stmt(const ExprStmt& stmt);
    void compile_block(const BlockStmt& stmt);
    void compile_if(const IfStmt& stmt);
    void compile_while(const WhileStmt& stmt);

    void compile_expr(const Expr& expr);
    void compile_binary(const BinaryExpr& expr);
    void compile_unary(const UnaryExpr& expr);
    void compile_assign(const AssignExpr& expr);
    void compile_variable(const VariableExpr& expr);
};

}  // namespace oocc
