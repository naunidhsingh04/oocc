// DEMONSTRATES: nested loops -- a multiplication table.
// Two while loops, one inside the other, each lowering to their own
// JUMP_IF_FALSE/LOOP pair. The trace pane's step count for this program
// is dominated by the inner loop: with i in [1,3] and j in [1,3] the
// inner PRINT runs 9 times, which is a concrete, countable illustration
// of why nested loops multiply rather than add their iteration counts --
// exactly the intuition the complexity analyst (main product, PRD §4.3)
// builds empirically for real programs.
let i = 1;
while (i <= 3) {
  let j = 1;
  while (j <= 3) {
    print i * j;
    j = j + 1;
  }
  i = i + 1;
}
