import { describe, expect, it } from "vitest";
import { computeLoopBrackets } from "./loops";
import { loadFixture } from "./testHelpers";

describe("computeLoopBrackets", () => {
  it("finds binary_search's single while loop with 4 iterations", () => {
    const { trace } = loadFixture("binary_search");
    const brackets = computeLoopBrackets(trace);
    const whileLoop = brackets.find((b) => b.frameId === "f1");

    expect(whileLoop).toBeDefined();
    expect(whileLoop?.headerLine).toBe(3);
    expect(whileLoop?.iterationStarts).toEqual([6, 11, 16, 21]);
    expect(whileLoop?.startStep).toBe(6);
    expect(whileLoop?.endStep).toBe(25);
    expect(whileLoop?.depth).toBe(0);
  });

  it("nests bubble_sort's inner for-loop under the outer for-loop", () => {
    const { trace } = loadFixture("bubble_sort");
    const brackets = computeLoopBrackets(trace);

    expect(brackets.length).toBeGreaterThanOrEqual(2);
    const nested = brackets.filter((b) => b.depth > 0);
    expect(nested.length).toBeGreaterThan(0);

    for (const inner of nested) {
      const outer = brackets.find(
        (b) => b !== inner && b.startStep <= inner.startStep && b.endStep >= inner.endStep,
      );
      expect(outer).toBeDefined();
    }
  });

  it("finds the module-level driver loop but no bracket inside any fib() call", () => {
    const { trace } = loadFixture("fibonacci_recursion");
    const brackets = computeLoopBrackets(trace);

    // The `for i in range(8): print(..., fib(i))` driver loop in <module>.
    // CPython emits a line-7 event for each of the 8 bodies plus one more
    // when the iterator is exhausted and the loop condition finally tests
    // false — 9 entries into line 7 total.
    const driverLoop = brackets.find((b) => b.frameId === "f0");
    expect(driverLoop?.headerLine).toBe(7);
    expect(driverLoop?.iterationStarts).toHaveLength(9);

    // fib(n) itself is `if n < 2: return n; return fib(n-1) + fib(n-2)` —
    // no loop. Every recursive call is a distinct frame_id with a
    // strictly-increasing line sequence, so none produces a bracket;
    // recursion shows up as depth, never as a loop iteration.
    const insideFib = brackets.filter((b) => b.frameId !== "f0");
    expect(insideFib).toEqual([]);
  });
});
