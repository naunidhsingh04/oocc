// DEMONSTRATES: a deliberate parse error, and that the explorer reports
// it as a structured error with a source span -- not just a message
// string. The `let` statement below is missing its terminating ';',
// so the parser, expecting one after the initializer expression, instead
// finds the next statement's `print` keyword and fails there. Run this
// through `--emit=ast` (or `all`) and the tool exits 1, printing
// {"error": {"stage": "ParseError", "message": "...", "span": {...}}}
// with the span pointing at the unexpected `print` token on line 2.
let x = 1
print x;
