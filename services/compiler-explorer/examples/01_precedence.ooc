// DEMONSTRATES: operator precedence.
// `2 + 3 * 4` must parse as `2 + (3 * 4)` = 14, not `(2 + 3) * 4` = 20.
// In the AST pane this shows up as the '*' node nesting *under* the '+'
// node's right child; in the bytecode pane, MUL executes before ADD.
print 2 + 3 * 4;   // expect: 14
print (2 + 3) * 4; // expect: 20 -- explicit parens flip the shape
