// DEMONSTRATES: the accumulator pattern (sum 1..n), the single most
// common shape in intro CS -- a running total updated once per loop
// iteration. Pairs well with the main product's complexity analyst: run
// this with different `n` values and step_count grows linearly, an
// empirical O(n) a learner can watch happen one PRINT at a time rather
// than take on faith.
let n = 10;
let i = 1;
let sum = 0;
while (i <= n) {
  sum = sum + i;
  i = i + 1;
}
print sum; // 1+2+...+10 = 55
