# Example programs

Ten `.ooc` source files, each with an in-file comment explaining what it
demonstrates and (where relevant) the expected output. Run any of them
through the CLI:

```sh
build/oocc_compiler --emit=all examples/01_precedence.ooc
```

| File | Demonstrates |
|---|---|
| `01_precedence.ooc` | Operator precedence (`*` binds tighter than `+`) |
| `02_loop_lowering.ooc` | `while` lowering to `JUMP_IF_FALSE` / `LOOP` |
| `03_scope_shadowing.ooc` | Block scope and variable shadowing |
| `04_conditionals.ooc` | `if`/`else` chains lowering to forward jumps |
| `05_boolean_logic.ooc` | Comparisons, equality, unary `!` |
| `06_nested_loops.ooc` | Nested loops (multiplication table) |
| `07_globals_vs_locals.ooc` | `GET_GLOBAL`/`SET_GLOBAL` vs. `GET_LOCAL`/`SET_LOCAL` |
| `08_arithmetic_mixed.ooc` | Unary minus, modulo, and left-associativity |
| `09_accumulator_sum.ooc` | The accumulator loop pattern (sum 1..n) |
| `10_parse_error.ooc` | **Deliberate parse error** — missing `;`, verifies the structured-error/span path |

`10_parse_error.ooc` is expected to make the CLI exit with status 1 and
print `{"error": {...}}` instead of the usual stage output — that is the
point of the example, not a bug.
