#pragma once
#include <string>

#include "oocc_compiler/span.hpp"

namespace oocc {

enum class TokenType {
    Number,
    Ident,
    // keywords
    Let,
    Print,
    If,
    Else,
    While,
    True,
    False,
    // one- and two-char operators/punctuation
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Equal,
    EqualEqual,
    BangEqual,
    Bang,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    LParen,
    RParen,
    LBrace,
    RBrace,
    Semicolon,
    Eof,
};

// Human-readable token type name, used verbatim as the `type` field in the
// `--emit=tokens` JSON and in bytecode comments.
const char* token_type_name(TokenType t);

struct Token {
    TokenType type;
    std::string lexeme;
    Span span;
};

}  // namespace oocc
