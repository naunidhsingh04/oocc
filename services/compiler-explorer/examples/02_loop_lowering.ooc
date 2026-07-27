// DEMONSTRATES: loop-lowering-to-jumps.
// A `while` compiles to: [condition] JUMP_IF_FALSE(exit) POP [body] LOOP(top)
// POP. Watch the bytecode pane: the LOOP instruction's operand is a
// *backward* jump (pc less than its own pc); JUMP_IF_FALSE's operand is
// forward, past the loop body. Five iterations means the VM trace shows
// the same instruction range replayed five times -- the ribbon idea from
// the main product's trace player, applied to bytecode instead of source.
let i = 0;
while (i < 5) {
  print i;
  i = i + 1;
}
