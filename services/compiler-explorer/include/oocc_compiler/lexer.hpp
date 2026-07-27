#pragma once
#include <string>
#include <vector>

#include "oocc_compiler/token.hpp"

namespace oocc {

// Hand-written single-pass scanner over the raw source bytes. Produces a
// flat token list (EOF-terminated) with byte offsets that the parser and
// the trace JSON both key off of. Throws OoccError(ErrorStage::Lex) on the
// first unrecognized character or unterminated construct.
class Lexer {
public:
    explicit Lexer(std::string source);

    // Scans the whole source and returns every token, including a
    // trailing Eof token whose span is a zero-width point just past the
    // last byte.
    std::vector<Token> scan_all();

private:
    std::string src_;
    int pos_ = 0;
    int line_ = 1;
    int col_ = 1;

    bool at_end() const;
    char peek() const;
    char peek_next() const;
    char advance();
    bool match(char expected);
    void skip_whitespace_and_comments();
    Token make_token(TokenType type, int start, int start_line, int start_col);
    Token scan_number(int start, int start_line, int start_col);
    Token scan_ident(int start, int start_line, int start_col);
};

}  // namespace oocc
