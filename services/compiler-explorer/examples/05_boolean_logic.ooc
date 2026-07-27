// DEMONSTRATES: comparison/equality operators and unary `!`.
// All six comparisons (< <= > >= == !=) share one BinaryExpr AST shape,
// differing only in the `op` field and, downstream, in which opcode the
// compiler picks (LESS, LESS_EQUAL, GREATER, GREATER_EQUAL, EQUAL,
// NOT_EQUAL). `!` is a UnaryExpr producing a NOT opcode. Useful for
// showing that the language's only two runtime types are number and
// bool, and comparisons always produce a bool.
print 3 < 5;
print 5 <= 5;
print 7 > 2;
print 2 >= 9;
print 4 == 4;
print 4 != 4;
print !(4 == 4);
