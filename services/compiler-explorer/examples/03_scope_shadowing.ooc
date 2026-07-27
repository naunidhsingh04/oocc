// DEMONSTRATES: scope.
// The inner `{ }` block declares its own `x`, which shadows the outer
// global `x` only inside the block; leaving the block emits a POP that
// discards the local's stack slot, and the next `print x;` resolves back
// to the global. In the bytecode pane, the first `print x` inside the
// block compiles to GET_LOCAL, the last one compiles to GET_GLOBAL --
// same variable name, different opcode, because scope is a compile-time
// fact, not a runtime one.
let x = 1;
print x;      // 1 (global)
{
  let x = 2;
  print x;    // 2 (shadowing local)
  {
    let x = 3;
    print x;  // 3 (nested shadow)
  }
  print x;    // 2 (back to the middle scope)
}
print x;      // 1 (back to the global)
