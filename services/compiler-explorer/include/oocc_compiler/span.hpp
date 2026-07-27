#pragma once
// Source span: a half-open byte range [start, end) into the original
// source buffer, plus the 1-based line/column of `start`. Used uniformly
// by tokens, AST nodes, and structured errors so the frontend can map any
// of the five panes back onto the same source characters.
namespace oocc {

struct Span {
    int start = 0;   // byte offset, inclusive
    int end = 0;     // byte offset, exclusive
    int line = 1;    // 1-based line of `start`
    int column = 1;  // 1-based column of `start` (in bytes, not codepoints)

    static Span join(const Span& a, const Span& b) {
        // Union of two spans; used when a parent AST node's span is
        // derived from its first and last child.
        Span s;
        s.start = a.start < b.start ? a.start : b.start;
        s.end = a.end > b.end ? a.end : b.end;
        s.line = a.line;
        s.column = a.column;
        return s;
    }
};

}  // namespace oocc
