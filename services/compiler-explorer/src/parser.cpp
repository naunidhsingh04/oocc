#include "oocc_compiler/parser.hpp"

#include "oocc_compiler/errors.hpp"

namespace oocc {

namespace {
template <typename T, typename... Args>
std::unique_ptr<T> make_node(int id, Args&&... args) {
    auto node = std::make_unique<T>(std::forward<Args>(args)...);
    node->id = id;
    return node;
}
}  // namespace

Parser::Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)) {}

const Token& Parser::peek() const { return tokens_[pos_]; }
const Token& Parser::previous() const { return tokens_[pos_ - 1]; }
bool Parser::at_end() const { return peek().type == TokenType::Eof; }

const Token& Parser::advance() {
    if (!at_end()) pos_++;
    return previous();
}

bool Parser::check(TokenType type) const {
    if (at_end() && type != TokenType::Eof) return false;
    return peek().type == type;
}

bool Parser::match(TokenType type) {
    if (!check(type)) return false;
    advance();
    return true;
}

const Token& Parser::expect(TokenType type, const std::string& message) {
    if (check(type)) return advance();
    const Token& tok = peek();
    throw OoccError(ErrorStage::Parse,
                     message + " (found " + token_type_name(tok.type) +
                         (tok.lexeme.empty() ? "" : " '" + tok.lexeme + "'") + ")",
                     tok.span);
}

std::unique_ptr<Program> Parser::parse() {
    auto program = std::make_unique<Program>();
    program->id = next_id();  // root: always id 0
    program->span.start = 0;
    program->span.line = 1;
    program->span.column = 1;
    while (!at_end()) {
        program->statements.push_back(statement());
    }
    if (!program->statements.empty()) {
        program->span = Span::join(program->statements.front()->span, program->statements.back()->span);
    } else {
        program->span.end = peek().span.end;
    }
    return program;
}

std::unique_ptr<Stmt> Parser::statement() {
    if (check(TokenType::Let)) return let_declaration();
    if (check(TokenType::Print)) return print_statement();
    if (check(TokenType::If)) return if_statement();
    if (check(TokenType::While)) return while_statement();
    if (check(TokenType::LBrace)) return block();
    return expr_statement();
}

std::unique_ptr<LetStmt> Parser::let_declaration() {
    int id = next_id();
    Span start_span = peek().span;
    expect(TokenType::Let, "expected 'let'");
    const Token& name_tok = expect(TokenType::Ident, "expected variable name after 'let'");
    expect(TokenType::Equal, "expected '=' after variable name");
    auto init = expression();
    const Token& semi = expect(TokenType::Semicolon, "expected ';' after 'let' statement");
    auto node = make_node<LetStmt>(id);
    node->name = name_tok.lexeme;
    node->init = std::move(init);
    node->span = Span::join(start_span, semi.span);
    return node;
}

std::unique_ptr<PrintStmt> Parser::print_statement() {
    int id = next_id();
    Span start_span = peek().span;
    expect(TokenType::Print, "expected 'print'");
    auto value = expression();
    const Token& semi = expect(TokenType::Semicolon, "expected ';' after 'print' statement");
    auto node = make_node<PrintStmt>(id);
    node->value = std::move(value);
    node->span = Span::join(start_span, semi.span);
    return node;
}

std::unique_ptr<BlockStmt> Parser::block() {
    int id = next_id();
    Span start_span = peek().span;
    expect(TokenType::LBrace, "expected '{'");
    auto node = make_node<BlockStmt>(id);
    while (!check(TokenType::RBrace) && !at_end()) {
        node->statements.push_back(statement());
    }
    const Token& close = expect(TokenType::RBrace, "expected '}' to close block");
    node->span = Span::join(start_span, close.span);
    return node;
}

std::unique_ptr<IfStmt> Parser::if_statement() {
    int id = next_id();
    Span start_span = peek().span;
    expect(TokenType::If, "expected 'if'");
    expect(TokenType::LParen, "expected '(' after 'if'");
    auto cond = expression();
    expect(TokenType::RParen, "expected ')' after if condition");
    auto then_branch = block();
    std::unique_ptr<BlockStmt> else_branch;
    Span end_span = then_branch->span;
    if (match(TokenType::Else)) {
        else_branch = block();
        end_span = else_branch->span;
    }
    auto node = make_node<IfStmt>(id);
    node->condition = std::move(cond);
    node->then_branch = std::move(then_branch);
    node->else_branch = std::move(else_branch);
    node->span = Span::join(start_span, end_span);
    return node;
}

std::unique_ptr<WhileStmt> Parser::while_statement() {
    int id = next_id();
    Span start_span = peek().span;
    expect(TokenType::While, "expected 'while'");
    expect(TokenType::LParen, "expected '(' after 'while'");
    auto cond = expression();
    expect(TokenType::RParen, "expected ')' after while condition");
    auto body = block();
    auto node = make_node<WhileStmt>(id);
    node->condition = std::move(cond);
    Span end_span = body->span;
    node->body = std::move(body);
    node->span = Span::join(start_span, end_span);
    return node;
}

std::unique_ptr<ExprStmt> Parser::expr_statement() {
    int id = next_id();
    auto expr = expression();
    const Token& semi = expect(TokenType::Semicolon, "expected ';' after expression");
    auto node = make_node<ExprStmt>(id);
    Span start_span = expr->span;
    node->expr = std::move(expr);
    node->span = Span::join(start_span, semi.span);
    return node;
}

std::unique_ptr<Expr> Parser::expression() { return assignment(); }

std::unique_ptr<Expr> Parser::assignment() {
    // Lookahead: IDENT '=' begins an assignment; anything else falls
    // through to equality (and further down the precedence chain).
    if (check(TokenType::Ident) && pos_ + 1 < static_cast<int>(tokens_.size()) &&
        tokens_[pos_ + 1].type == TokenType::Equal) {
        int id = next_id();
        const Token& name_tok = advance();  // IDENT
        advance();                          // '='
        auto value = assignment();
        auto node = make_node<AssignExpr>(id);
        node->name = name_tok.lexeme;
        Span end_span = value->span;
        node->value = std::move(value);
        node->span = Span::join(name_tok.span, end_span);
        return node;
    }
    return equality();
}

std::unique_ptr<Expr> Parser::equality() {
    auto expr = comparison();
    while (check(TokenType::EqualEqual) || check(TokenType::BangEqual)) {
        int id = next_id();
        TokenType op = advance().type;
        auto right = comparison();
        auto node = make_node<BinaryExpr>(id);
        node->op = op;
        Span left_span = expr->span, right_span = right->span;
        node->left = std::move(expr);
        node->right = std::move(right);
        node->span = Span::join(left_span, right_span);
        expr = std::move(node);
    }
    return expr;
}

std::unique_ptr<Expr> Parser::comparison() {
    auto expr = term();
    while (check(TokenType::Less) || check(TokenType::LessEqual) || check(TokenType::Greater) ||
           check(TokenType::GreaterEqual)) {
        int id = next_id();
        TokenType op = advance().type;
        auto right = term();
        auto node = make_node<BinaryExpr>(id);
        node->op = op;
        Span left_span = expr->span, right_span = right->span;
        node->left = std::move(expr);
        node->right = std::move(right);
        node->span = Span::join(left_span, right_span);
        expr = std::move(node);
    }
    return expr;
}

std::unique_ptr<Expr> Parser::term() {
    auto expr = factor();
    while (check(TokenType::Plus) || check(TokenType::Minus)) {
        int id = next_id();
        TokenType op = advance().type;
        auto right = factor();
        auto node = make_node<BinaryExpr>(id);
        node->op = op;
        Span left_span = expr->span, right_span = right->span;
        node->left = std::move(expr);
        node->right = std::move(right);
        node->span = Span::join(left_span, right_span);
        expr = std::move(node);
    }
    return expr;
}

std::unique_ptr<Expr> Parser::factor() {
    auto expr = unary();
    while (check(TokenType::Star) || check(TokenType::Slash) || check(TokenType::Percent)) {
        int id = next_id();
        TokenType op = advance().type;
        auto right = unary();
        auto node = make_node<BinaryExpr>(id);
        node->op = op;
        Span left_span = expr->span, right_span = right->span;
        node->left = std::move(expr);
        node->right = std::move(right);
        node->span = Span::join(left_span, right_span);
        expr = std::move(node);
    }
    return expr;
}

std::unique_ptr<Expr> Parser::unary() {
    if (check(TokenType::Minus) || check(TokenType::Bang)) {
        int id = next_id();
        Span start_span = peek().span;
        TokenType op = advance().type;
        auto operand = unary();
        auto node = make_node<UnaryExpr>(id);
        node->op = op;
        Span end_span = operand->span;
        node->operand = std::move(operand);
        node->span = Span::join(start_span, end_span);
        return node;
    }
    return primary();
}

std::unique_ptr<Expr> Parser::primary() {
    if (check(TokenType::Number)) {
        int id = next_id();
        const Token& tok = advance();
        auto node = make_node<NumberExpr>(id);
        node->value = std::stod(tok.lexeme);
        node->span = tok.span;
        return node;
    }
    if (check(TokenType::True) || check(TokenType::False)) {
        int id = next_id();
        const Token& tok = advance();
        auto node = make_node<BoolExpr>(id);
        node->value = (tok.type == TokenType::True);
        node->span = tok.span;
        return node;
    }
    if (check(TokenType::Ident)) {
        int id = next_id();
        const Token& tok = advance();
        auto node = make_node<VariableExpr>(id);
        node->name = tok.lexeme;
        node->span = tok.span;
        return node;
    }
    if (check(TokenType::LParen)) {
        advance();
        auto expr = expression();
        expect(TokenType::RParen, "expected ')' after expression");
        return expr;
    }
    const Token& tok = peek();
    throw OoccError(ErrorStage::Parse,
                     std::string("expected an expression (found ") + token_type_name(tok.type) +
                         (tok.lexeme.empty() ? "" : " '" + tok.lexeme + "'") + ")",
                     tok.span);
}

}  // namespace oocc
