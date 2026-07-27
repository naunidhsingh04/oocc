// DEMONSTRATES: full arithmetic precedence chain, including unary minus
// and modulo, in one expression. Precedence (loosest to tightest):
// comparison < equality-adjacent, then +/-, then * / %, then unary.
// `-2 * 3 + 10 % 4` should read as `((-2) * 3) + (10 % 4)` = -6 + 2 = -4.
// Good for stress-testing that the recursive-descent `unary` rule binds
// tighter than `factor`, and `factor` binds tighter than `term`.
print -2 * 3 + 10 % 4; // expect: -4
print 2 - 3 - 4;       // expect: -5 (left-associative: (2-3)-4)
print 2 - (3 - 4);     // expect: 3  (parens override associativity)
