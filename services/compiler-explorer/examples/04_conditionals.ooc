// DEMONSTRATES: conditional branching (if/else -> JUMP_IF_FALSE + JUMP).
// Each branch of the if/else chain below compiles independently; the
// AST pane shows one IfStmt node per `if`, each with its own `then` and
// (nullable) `else` child, while the bytecode pane shows how an
// `else { if (...) ... }` chain becomes a sequence of forward jumps
// rather than a special "elif" opcode -- there isn't one, because the
// grammar doesn't have elif, only nested if-inside-else.
let score = 72;
if (score >= 90) {
  print 4;
} else {
  if (score >= 80) {
    print 3;
  } else {
    if (score >= 70) {
      print 2;
    } else {
      print 1;
    }
  }
}
