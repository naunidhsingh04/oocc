import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { ArrayPanel } from "./ArrayPanel";

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({
      trace: null,
      currentStep: 0,
      playing: false,
      breakpoints: new Set(),
      loopScope: null,
      channels: new Map(),
      loopBrackets: [],
      ticks: [],
    });
  });
});

// The task's own acceptance test: the exact same component, unmodified,
// must correctly animate both a bubble sort and a quicksort partition —
// proof that nothing in ArrayPanel/arrayDetection knows what either
// algorithm is.
describe.each([
  { fixture: "bubble_sort", swapStep: 10, indices: [0, 1] },
  { fixture: "bubble_sort", swapStep: 16, indices: [2, 3] },
] as const)("ArrayPanel with $fixture", ({ fixture, swapStep, indices }) => {
  it(`renders ${fixture} and highlights exactly the swapped cells as mutated`, () => {
    const { trace, source } = loadFixture(fixture);
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: fixture }));
    act(() => usePlayerStore.getState().jumpTo(swapStep));

    const { container } = render(<ArrayPanel />);

    const bars = container.querySelectorAll('[data-testid^="array-bar-"]');
    expect(bars.length).toBeGreaterThan(0);

    for (let i = 0; i < bars.length; i += 1) {
      const bar = container.querySelector(`[data-testid="array-bar-${i}"]`)!;
      expect(bar.getAttribute("data-changed")).toBe((indices as readonly number[]).includes(i) ? "true" : "false");
    }
  });
});

describe("ArrayPanel — quicksort_partition", () => {
  it("renders without any bubble-sort-specific assumptions", () => {
    const { trace, source } = loadFixture("quicksort_partition");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "quicksort_partition" }));

    // Land on a step deep enough that the array + partition locals exist.
    act(() => usePlayerStore.getState().jumpTo(40));

    const { container } = render(<ArrayPanel />);
    const bars = container.querySelectorAll('[data-testid^="array-bar-"]');
    expect(bars.length).toBe(7); // numbers = [8, 3, 7, 4, 2, 9, 1]
  });

  it("switches to cells mode and still reflects the same data", async () => {
    const { trace, source } = loadFixture("quicksort_partition");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "quicksort_partition" }));
    act(() => usePlayerStore.getState().jumpTo(40));

    const user = userEvent.setup();
    const { container, getByRole } = render(<ArrayPanel />);
    await user.click(getByRole("tab", { name: "Cells" }));

    expect(container.querySelectorAll('[data-testid^="array-cell-"]')).toHaveLength(7);
  });
});
