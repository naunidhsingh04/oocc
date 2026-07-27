#include "oocc_compiler/compiler.hpp"

#include "oocc_compiler/token.hpp"

namespace oocc {

int Compiler::emit(OpCode op, int ast_id, Span span, std::string comment, int operand) {
    Instruction instr;
    instr.pc = static_cast<int>(chunk_.instructions.size());
    instr.opcode = op;
    if (operand >= 0) instr.operands.push_back(operand);
    instr.line = span.line;
    instr.span = span;
    instr.comment = std::move(comment);
    instr.astId = ast_id;
    chunk_.instructions.push_back(instr);
    return instr.pc;
}

int Compiler::add_constant(double value) {
    chunk_.constants.push_back(value);
    return static_cast<int>(chunk_.constants.size()) - 1;
}

int Compiler::add_name(const std::string& name) {
    // Reuse an existing pool entry if this name was already interned, so
    // the JSON constant/name tables stay small and readable.
    for (size_t i = 0; i < chunk_.names.size(); ++i) {
        if (chunk_.names[i] == name) return static_cast<int>(i);
    }
    chunk_.names.push_back(name);
    return static_cast<int>(chunk_.names.size()) - 1;
}

void Compiler::patch_jump(int instruction_index, int target_pc) {
    chunk_.instructions[instruction_index].operands[0] = target_pc;
}

int Compiler::resolve_local(const std::string& name) const {
    for (int i = static_cast<int>(locals_.size()) - 1; i >= 0; --i) {
        if (locals_[i].name == name) return i;
    }
    return -1;
}

void Compiler::begin_scope() { scope_depth_++; }

void Compiler::end_scope(int ast_id, Span span) {
    scope_depth_--;
    while (!locals_.empty() && locals_.back().depth > scope_depth_) {
        emit(OpCode::Pop, ast_id, span, "end of scope: discard local '" + locals_.back().name + "'");
        locals_.pop_back();
    }
}

Chunk Compiler::compile(const Program& program) {
    root_ast_id_ = program.id;
    for (const auto& stmt : program.statements) {
        compile_stmt(*stmt);
    }
    emit(OpCode::Halt, root_ast_id_, program.span, "end of program");
    return std::move(chunk_);
}

void Compiler::compile_stmt(const Stmt& stmt) {
    switch (stmt.kind) {
        case StmtKind::Let:
            compile_let(static_cast<const LetStmt&>(stmt));
            return;
        case StmtKind::Print:
            compile_print(static_cast<const PrintStmt&>(stmt));
            return;
        case StmtKind::ExprStmt:
            compile_expr_stmt(static_cast<const ExprStmt&>(stmt));
            return;
        case StmtKind::Block:
            compile_block(static_cast<const BlockStmt&>(stmt));
            return;
        case StmtKind::If:
            compile_if(static_cast<const IfStmt&>(stmt));
            return;
        case StmtKind::While:
            compile_while(static_cast<const WhileStmt&>(stmt));
            return;
    }
}

void Compiler::compile_let(const LetStmt& stmt) {
    compile_expr(*stmt.init);
    if (scope_depth_ > 0) {
        // Local: the value already sitting on the stack top *is* the
        // local's storage slot from here on; just remember its name/depth.
        locals_.push_back(Local{stmt.name, scope_depth_});
    } else {
        int name_idx = add_name(stmt.name);
        emit(OpCode::DefineGlobal, stmt.id, stmt.span, "define global '" + stmt.name + "'",
             name_idx);
    }
}

void Compiler::compile_print(const PrintStmt& stmt) {
    compile_expr(*stmt.value);
    emit(OpCode::Print, stmt.id, stmt.span, "print top of stack");
}

void Compiler::compile_expr_stmt(const ExprStmt& stmt) {
    compile_expr(*stmt.expr);
    emit(OpCode::Pop, stmt.id, stmt.span, "discard expression-statement result");
}

void Compiler::compile_block(const BlockStmt& stmt) {
    begin_scope();
    for (const auto& s : stmt.statements) compile_stmt(*s);
    end_scope(stmt.id, stmt.span);
}

void Compiler::compile_if(const IfStmt& stmt) {
    compile_expr(*stmt.condition);
    int then_jump =
        emit(OpCode::JumpIfFalse, stmt.id, stmt.span, "if false, skip 'then' branch", 0);
    emit(OpCode::Pop, stmt.id, stmt.span, "discard condition (taking 'then')");
    compile_block(*stmt.then_branch);
    int else_jump = emit(OpCode::Jump, stmt.id, stmt.span, "skip 'else' branch", 0);
    patch_jump(then_jump, static_cast<int>(chunk_.instructions.size()));
    emit(OpCode::Pop, stmt.id, stmt.span, "discard condition (taking 'else')");
    if (stmt.else_branch) compile_block(*stmt.else_branch);
    patch_jump(else_jump, static_cast<int>(chunk_.instructions.size()));
}

void Compiler::compile_while(const WhileStmt& stmt) {
    int loop_start = static_cast<int>(chunk_.instructions.size());
    compile_expr(*stmt.condition);
    int exit_jump =
        emit(OpCode::JumpIfFalse, stmt.id, stmt.span, "if false, exit loop", 0);
    emit(OpCode::Pop, stmt.id, stmt.span, "discard condition (entering body)");
    compile_block(*stmt.body);
    emit(OpCode::Loop, stmt.id, stmt.span, "jump back to loop condition", loop_start);
    patch_jump(exit_jump, static_cast<int>(chunk_.instructions.size()));
    emit(OpCode::Pop, stmt.id, stmt.span, "discard condition (loop exited)");
}

void Compiler::compile_expr(const Expr& expr) {
    switch (expr.kind) {
        case ExprKind::Number: {
            const auto& e = static_cast<const NumberExpr&>(expr);
            int idx = add_constant(e.value);
            emit(OpCode::Const, e.id, e.span, "push constant " + std::to_string(e.value),
                 idx);
            return;
        }
        case ExprKind::Bool: {
            const auto& e = static_cast<const BoolExpr&>(expr);
            emit(e.value ? OpCode::True : OpCode::False, e.id, e.span,
                 std::string("push ") + (e.value ? "true" : "false"));
            return;
        }
        case ExprKind::Variable:
            compile_variable(static_cast<const VariableExpr&>(expr));
            return;
        case ExprKind::Unary:
            compile_unary(static_cast<const UnaryExpr&>(expr));
            return;
        case ExprKind::Binary:
            compile_binary(static_cast<const BinaryExpr&>(expr));
            return;
        case ExprKind::Assign:
            compile_assign(static_cast<const AssignExpr&>(expr));
            return;
    }
}

void Compiler::compile_variable(const VariableExpr& expr) {
    int slot = resolve_local(expr.name);
    if (slot >= 0) {
        emit(OpCode::GetLocal, expr.id, expr.span, "push local '" + expr.name + "'", slot);
    } else {
        int name_idx = add_name(expr.name);
        emit(OpCode::GetGlobal, expr.id, expr.span, "push global '" + expr.name + "'",
             name_idx);
    }
}

void Compiler::compile_assign(const AssignExpr& expr) {
    compile_expr(*expr.value);
    int slot = resolve_local(expr.name);
    if (slot >= 0) {
        emit(OpCode::SetLocal, expr.id, expr.span, "store local '" + expr.name + "'", slot);
    } else {
        int name_idx = add_name(expr.name);
        emit(OpCode::SetGlobal, expr.id, expr.span, "store global '" + expr.name + "'",
             name_idx);
    }
}

void Compiler::compile_unary(const UnaryExpr& expr) {
    compile_expr(*expr.operand);
    if (expr.op == TokenType::Minus) {
        emit(OpCode::Negate, expr.id, expr.span, "negate");
    } else {
        emit(OpCode::Not, expr.id, expr.span, "logical not");
    }
}

void Compiler::compile_binary(const BinaryExpr& expr) {
    compile_expr(*expr.left);
    compile_expr(*expr.right);
    const char* cmt = nullptr;
    OpCode op;
    switch (expr.op) {
        case TokenType::Plus:
            op = OpCode::Add;
            cmt = "add";
            break;
        case TokenType::Minus:
            op = OpCode::Sub;
            cmt = "subtract";
            break;
        case TokenType::Star:
            op = OpCode::Mul;
            cmt = "multiply";
            break;
        case TokenType::Slash:
            op = OpCode::Div;
            cmt = "divide";
            break;
        case TokenType::Percent:
            op = OpCode::Mod;
            cmt = "modulo";
            break;
        case TokenType::EqualEqual:
            op = OpCode::Equal;
            cmt = "compare equal";
            break;
        case TokenType::BangEqual:
            op = OpCode::NotEqual;
            cmt = "compare not-equal";
            break;
        case TokenType::Less:
            op = OpCode::Less;
            cmt = "compare less-than";
            break;
        case TokenType::LessEqual:
            op = OpCode::LessEqual;
            cmt = "compare less-or-equal";
            break;
        case TokenType::Greater:
            op = OpCode::Greater;
            cmt = "compare greater-than";
            break;
        case TokenType::GreaterEqual:
            op = OpCode::GreaterEqual;
            cmt = "compare greater-or-equal";
            break;
        default:
            op = OpCode::Add;
            cmt = "add";
            break;
    }
    emit(op, expr.id, expr.span, cmt);
}

}  // namespace oocc
