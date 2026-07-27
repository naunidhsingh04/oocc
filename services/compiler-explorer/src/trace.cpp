#ifdef OOCC_TRACE
#include "oocc_compiler/trace.hpp"

#include <algorithm>
#include <string>
#include <vector>

namespace oocc {

json span_to_json(const Span& span) {
    json j;
    j["start"] = span.start;
    j["end"] = span.end;
    j["line"] = span.line;
    j["column"] = span.column;
    return j;
}

json token_to_json(const Token& token) {
    json j;
    j["type"] = token_type_name(token.type);
    j["lexeme"] = token.lexeme;
    j["line"] = token.span.line;
    j["column"] = token.span.column;
    j["start"] = token.span.start;
    j["end"] = token.span.end;
    return j;
}

json tokens_to_json(const std::vector<Token>& tokens) {
    json arr = json::array();
    for (const auto& t : tokens) arr.push_back(token_to_json(t));
    return arr;
}

namespace {

json expr_to_json(const Expr& e);
json stmt_to_json(const Stmt& s);

json expr_to_json(const Expr& e) {
    json j;
    j["id"] = e.id;
    j["span"] = span_to_json(e.span);
    switch (e.kind) {
        case ExprKind::Number: {
            const auto& n = static_cast<const NumberExpr&>(e);
            j["kind"] = "Number";
            j["value"] = n.value;
            break;
        }
        case ExprKind::Bool: {
            const auto& b = static_cast<const BoolExpr&>(e);
            j["kind"] = "Bool";
            j["value"] = b.value;
            break;
        }
        case ExprKind::Variable: {
            const auto& v = static_cast<const VariableExpr&>(e);
            j["kind"] = "Variable";
            j["name"] = v.name;
            break;
        }
        case ExprKind::Unary: {
            const auto& u = static_cast<const UnaryExpr&>(e);
            j["kind"] = "Unary";
            j["op"] = token_type_name(u.op);
            j["operand"] = expr_to_json(*u.operand);
            break;
        }
        case ExprKind::Binary: {
            const auto& b = static_cast<const BinaryExpr&>(e);
            j["kind"] = "Binary";
            j["op"] = token_type_name(b.op);
            j["left"] = expr_to_json(*b.left);
            j["right"] = expr_to_json(*b.right);
            break;
        }
        case ExprKind::Assign: {
            const auto& a = static_cast<const AssignExpr&>(e);
            j["kind"] = "Assign";
            j["name"] = a.name;
            j["value"] = expr_to_json(*a.value);
            break;
        }
    }
    return j;
}

json stmt_to_json(const Stmt& s) {
    json j;
    j["id"] = s.id;
    j["span"] = span_to_json(s.span);
    switch (s.kind) {
        case StmtKind::Let: {
            const auto& l = static_cast<const LetStmt&>(s);
            j["kind"] = "Let";
            j["name"] = l.name;
            j["init"] = expr_to_json(*l.init);
            break;
        }
        case StmtKind::Print: {
            const auto& p = static_cast<const PrintStmt&>(s);
            j["kind"] = "Print";
            j["value"] = expr_to_json(*p.value);
            break;
        }
        case StmtKind::ExprStmt: {
            const auto& es = static_cast<const ExprStmt&>(s);
            j["kind"] = "ExprStmt";
            j["expr"] = expr_to_json(*es.expr);
            break;
        }
        case StmtKind::Block: {
            const auto& b = static_cast<const BlockStmt&>(s);
            j["kind"] = "Block";
            json stmts = json::array();
            for (const auto& st : b.statements) stmts.push_back(stmt_to_json(*st));
            j["statements"] = stmts;
            break;
        }
        case StmtKind::If: {
            const auto& i = static_cast<const IfStmt&>(s);
            j["kind"] = "If";
            j["condition"] = expr_to_json(*i.condition);
            j["then"] = stmt_to_json(*i.then_branch);
            j["else"] = i.else_branch ? stmt_to_json(*i.else_branch) : json(nullptr);
            break;
        }
        case StmtKind::While: {
            const auto& w = static_cast<const WhileStmt&>(s);
            j["kind"] = "While";
            j["condition"] = expr_to_json(*w.condition);
            j["body"] = stmt_to_json(*w.body);
            break;
        }
    }
    return j;
}

}  // namespace

json ast_node_to_json(const Node& node) {
    if (const auto* e = dynamic_cast<const Expr*>(&node)) return expr_to_json(*e);
    if (const auto* s = dynamic_cast<const Stmt*>(&node)) return stmt_to_json(*s);
    return json{};
}

json ast_to_json(const Program& program) {
    json j;
    j["id"] = program.id;
    j["kind"] = "Program";
    j["span"] = span_to_json(program.span);
    json stmts = json::array();
    for (const auto& st : program.statements) stmts.push_back(stmt_to_json(*st));
    j["statements"] = stmts;
    return j;
}

json instruction_to_json(const Instruction& instr) {
    json j;
    j["pc"] = instr.pc;
    j["opcode"] = opcode_name(instr.opcode);
    j["operands"] = instr.operands;
    j["line"] = instr.line;
    j["span"] = span_to_json(instr.span);
    j["comment"] = instr.comment;
    j["astId"] = instr.astId;
    return j;
}

json bytecode_to_json(const Chunk& chunk) {
    json j;
    j["constants"] = chunk.constants;
    j["names"] = chunk.names;
    json instrs = json::array();
    for (const auto& i : chunk.instructions) instrs.push_back(instruction_to_json(i));
    j["instructions"] = instrs;
    return j;
}

json value_to_json(const Value& value) {
    json j;
    if (value.is_number()) {
        j["type"] = "number";
        j["value"] = value.number;
    } else {
        j["type"] = "bool";
        j["value"] = value.boolean;
    }
    return j;
}

json vm_step_to_json(const VmStep& step) {
    json j;
    j["pc"] = step.pc;
    j["opcode"] = opcode_name(step.opcode);
    json before = json::array();
    for (const auto& v : step.stack_before) before.push_back(value_to_json(v));
    json after = json::array();
    for (const auto& v : step.stack_after) after.push_back(value_to_json(v));
    j["stackBefore"] = before;
    j["stackAfter"] = after;
    // std::unordered_map iteration order is an implementation detail that
    // differs between the native (libstdc++/MinGW) and WASM (Emscripten's
    // libc++) builds — sorting by name here is what keeps native and WASM
    // output byte-identical rather than merely "the same set of keys."
    json globals = json::object();
    std::vector<std::string> names;
    names.reserve(step.globals.size());
    for (const auto& [name, v] : step.globals) names.push_back(name);
    std::sort(names.begin(), names.end());
    for (const auto& name : names) globals[name] = value_to_json(step.globals.at(name));
    j["globals"] = globals;
    j["stdoutDelta"] = step.stdout_delta;
    return j;
}

json trace_to_json(const std::vector<VmStep>& steps) {
    json arr = json::array();
    for (const auto& s : steps) arr.push_back(vm_step_to_json(s));
    return arr;
}

json error_to_json(const OoccError& error) {
    json j;
    j["stage"] = to_string(error.stage());
    j["message"] = std::string(error.what());
    j["span"] = span_to_json(error.span());
    return j;
}

}  // namespace oocc

#endif  // OOCC_TRACE
