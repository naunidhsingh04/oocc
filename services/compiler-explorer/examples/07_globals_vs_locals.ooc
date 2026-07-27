// DEMONSTRATES: globals vs. locals at the bytecode level.
// `total` is declared at the top level (scope depth 0) so every read/
// write of it compiles to GET_GLOBAL/SET_GLOBAL, keyed by name in the
// bytecode's `names` constant pool. `step`, declared inside the while
// loop's block, is a local: it compiles to GET_LOCAL/SET_LOCAL keyed by
// a numeric stack slot instead. Same-looking `x = x + 1;` statements,
// two different instruction families -- purely a function of where the
// `let` happened.
let total = 0;
let n = 4;
while (n > 0) {
  let step = n * n;
  total = total + step;
  n = n - 1;
}
print total; // 1 + 4 + 9 + 16 = 30
