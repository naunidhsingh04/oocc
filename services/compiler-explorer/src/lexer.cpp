#include "oocc_compiler/lexer.hpp"

#include <cctype>
#include <unordered_map>

#include "oocc_compiler/errors.hpp"

namespace oocc {

const char* token_type_name(TokenType t) {
    switch (t) {
        case TokenType::Number:
            return "NUMBER";
        case TokenType::Ident:
            return "IDENT";
        case TokenType::Let:
            return "LET";
        case TokenType::Print:
            return "PRINT";
        case TokenType::If:
            return "IF";
        case TokenType::Else:
            return "ELSE";
        case TokenType::While:
            return "WHILE";
        case TokenType::True:
            return "TRUE";
        case TokenType::False:
            return "FALSE";
        case TokenType::Plus:
            return "PLUS";
        case TokenType::Minus:
            return "MINUS";
        case TokenType::Star:
            return "STAR";
        case TokenType::Slash:
            return "SLASH";
        case TokenType::Percent:
            return "PERCENT";
        case TokenType::Equal:
            return "EQUAL";
        case TokenType::EqualEqual:
            return "EQUAL_EQUAL";
        case TokenType::BangEqual:
            return "BANG_EQUAL";
        case TokenType::Bang:
            return "BANG";
        case TokenType::Less:
            return "LESS";
        case TokenType::LessEqual:
            return "LESS_EQUAL";
        case TokenType::Greater:
            return "GREATER";
        case TokenType::GreaterEqual:
            return "GREATER_EQUAL";
        case TokenType::LParen:
            return "LPAREN";
        case TokenType::RParen:
            return "RPAREN";
        case TokenType::LBrace:
            return "LBRACE";
        case TokenType::RBrace:
            return "RBRACE";
        case TokenType::Semicolon:
            return "SEMICOLON";
        case TokenType::Eof:
            return "EOF";
    }
    return "UNKNOWN";
}

namespace {
const std::unordered_map<std::string, TokenType>& keywords() {
    static const std::unordered_map<std::string, TokenType> kw = {
        {"let", TokenType::Let},     {"print", TokenType::Print},
        {"if", TokenType::If},       {"else", TokenType::Else},
        {"while", TokenType::While}, {"true", TokenType::True},
        {"false", TokenType::False},
    };
    return kw;
}
}  // namespace

Lexer::Lexer(std::string source) : src_(std::move(source)) {}

bool Lexer::at_end() const { return pos_ >= static_cast<int>(src_.size()); }

char Lexer::peek() const { return at_end() ? '\0' : src_[pos_]; }

char Lexer::peek_next() const {
    return (pos_ + 1 >= static_cast<int>(src_.size())) ? '\0' : src_[pos_ + 1];
}

char Lexer::advance() {
    char c = src_[pos_++];
    if (c == '\n') {
        line_++;
        col_ = 1;
    } else {
        col_++;
    }
    return c;
}

bool Lexer::match(char expected) {
    if (at_end() || src_[pos_] != expected) return false;
    advance();
    return true;
}

void Lexer::skip_whitespace_and_comments() {
    for (;;) {
        char c = peek();
        if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
            advance();
        } else if (c == '/' && peek_next() == '/') {
            while (!at_end() && peek() != '\n') advance();
        } else {
            return;
        }
    }
}

Token Lexer::make_token(TokenType type, int start, int start_line, int start_col) {
    Token t;
    t.type = type;
    t.lexeme = src_.substr(start, pos_ - start);
    t.span = Span{start, pos_, start_line, start_col};
    return t;
}

Token Lexer::scan_number(int start, int start_line, int start_col) {
    while (std::isdigit(static_cast<unsigned char>(peek()))) advance();
    if (peek() == '.' && std::isdigit(static_cast<unsigned char>(peek_next()))) {
        advance();
        while (std::isdigit(static_cast<unsigned char>(peek()))) advance();
    }
    return make_token(TokenType::Number, start, start_line, start_col);
}

Token Lexer::scan_ident(int start, int start_line, int start_col) {
    while (std::isalnum(static_cast<unsigned char>(peek())) || peek() == '_') advance();
    std::string text = src_.substr(start, pos_ - start);
    auto it = keywords().find(text);
    TokenType type = (it != keywords().end()) ? it->second : TokenType::Ident;
    return make_token(type, start, start_line, start_col);
}

std::vector<Token> Lexer::scan_all() {
    std::vector<Token> tokens;
    for (;;) {
        skip_whitespace_and_comments();
        if (at_end()) {
            tokens.push_back(make_token(TokenType::Eof, pos_, line_, col_));
            break;
        }
        int start = pos_;
        int start_line = line_;
        int start_col = col_;
        char c = advance();

        if (std::isdigit(static_cast<unsigned char>(c))) {
            tokens.push_back(scan_number(start, start_line, start_col));
            continue;
        }
        if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
            tokens.push_back(scan_ident(start, start_line, start_col));
            continue;
        }

        switch (c) {
            case '+':
                tokens.push_back(make_token(TokenType::Plus, start, start_line, start_col));
                continue;
            case '-':
                tokens.push_back(make_token(TokenType::Minus, start, start_line, start_col));
                continue;
            case '*':
                tokens.push_back(make_token(TokenType::Star, start, start_line, start_col));
                continue;
            case '/':
                tokens.push_back(make_token(TokenType::Slash, start, start_line, start_col));
                continue;
            case '%':
                tokens.push_back(make_token(TokenType::Percent, start, start_line, start_col));
                continue;
            case '(':
                tokens.push_back(make_token(TokenType::LParen, start, start_line, start_col));
                continue;
            case ')':
                tokens.push_back(make_token(TokenType::RParen, start, start_line, start_col));
                continue;
            case '{':
                tokens.push_back(make_token(TokenType::LBrace, start, start_line, start_col));
                continue;
            case '}':
                tokens.push_back(make_token(TokenType::RBrace, start, start_line, start_col));
                continue;
            case ';':
                tokens.push_back(make_token(TokenType::Semicolon, start, start_line, start_col));
                continue;
            case '=':
                tokens.push_back(make_token(match('=') ? TokenType::EqualEqual : TokenType::Equal,
                                             start, start_line, start_col));
                continue;
            case '!':
                tokens.push_back(make_token(match('=') ? TokenType::BangEqual : TokenType::Bang,
                                             start, start_line, start_col));
                continue;
            case '<':
                tokens.push_back(make_token(match('=') ? TokenType::LessEqual : TokenType::Less,
                                             start, start_line, start_col));
                continue;
            case '>':
                tokens.push_back(make_token(
                    match('=') ? TokenType::GreaterEqual : TokenType::Greater, start, start_line,
                    start_col));
                continue;
            default: {
                Span span{start, pos_, start_line, start_col};
                std::string msg = "Unexpected character '";
                msg += c;
                msg += "'";
                throw OoccError(ErrorStage::Lex, msg, span);
            }
        }
    }
    return tokens;
}

}  // namespace oocc
