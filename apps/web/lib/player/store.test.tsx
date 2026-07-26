import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getStateAt } from "./getStateAt";
import { usePlayerStore } from "./store";
import { loadFixture, makeSyntheticTrace } from "./testHelpers";

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({
      trace: null,
      currentStep: 0,
      playing: false,
      speed: 1,
      breakpoints: new Set(),
      loopScope: null,
      channels: new Map(),
      loopBrackets: [],
      ticks: [],
    });
  });
});

function EditorLineProbe({ onRender }: { onRender: () => void }) {
  const line = usePlayerStore((state) => getStateAt(state.trace, state.currentStep)?.line);
  onRender();
  return <span data-testid="line">{line}</span>;
}

describe("usePlayerStore — editor re-render discipline", () => {
  it("does not re-render a line-selector component when scrubbing stays on the same source line", () => {
    // Stands in for the 40k-step fixture: cheap to build, same shape, and
    // its line repeats every 4 steps the way a loop body's does.
    const trace = makeSyntheticTrace(40_000);
    act(() => usePlayerStore.getState().loadTrace({ trace, source: "", name: "synthetic" }));

    let renderCount = 0;
    render(<EditorLineProbe onRender={() => (renderCount += 1)} />);
    expect(renderCount).toBe(1);

    // i=0,4,8,...,4000 all land on line 3 (i % 4 === 0) — scrubbing across
    // a thousand of them must not move the subscribed `line` value at all.
    act(() => {
      for (let i = 0; i <= 4000; i += 4) {
        usePlayerStore.getState().jumpTo(i);
      }
    });

    expect(renderCount).toBe(1);

    // Moving to a step on a *different* line is the one case that must
    // re-render.
    act(() => usePlayerStore.getState().jumpTo(1));
    expect(renderCount).toBe(2);
  });
});

describe("usePlayerStore — stepping through recursion", () => {
  it("steps backward exactly through fibonacci's recursive call stack", () => {
    const { trace, source } = loadFixture("fibonacci_recursion");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "fibonacci_recursion" }));

    const deepIndex = trace.steps.reduce(
      (deepest, step) => (step.depth > trace.steps[deepest]!.depth ? step.i : deepest),
      0,
    );

    act(() => usePlayerStore.getState().jumpTo(deepIndex));
    const original = getStateAt(usePlayerStore.getState().trace, deepIndex);

    // Walk forward to the end, then step all the way back one at a time.
    act(() => usePlayerStore.getState().jumpToEnd());
    act(() => {
      const store = usePlayerStore.getState();
      const steps = store.trace!.steps.length - 1 - deepIndex;
      for (let i = 0; i < steps; i += 1) usePlayerStore.getState().stepBackward();
    });

    expect(usePlayerStore.getState().currentStep).toBe(deepIndex);
    const replayed = getStateAt(usePlayerStore.getState().trace, deepIndex);
    expect(replayed).toStrictEqual(original);
    expect(replayed?.depth).toBeGreaterThan(1);
  });
});

describe("usePlayerStore — breakpoints and loop scope", () => {
  it("stops playback advance when it lands on a breakpointed line", () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));
    act(() => usePlayerStore.getState().toggleBreakpoint(3)); // the while-loop header

    act(() => {
      usePlayerStore.getState().play();
      usePlayerStore.getState().advanceBy(20);
    });

    const state = usePlayerStore.getState();
    expect(state.playing).toBe(false);
    expect(getStateAt(state.trace, state.currentStep)?.line).toBe(3);
  });

  it("wraps playback back to the loop start once it reaches the loop scope end", () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));
    act(() => usePlayerStore.getState().setLoopScope({ start: 6, end: 10 }));
    act(() => usePlayerStore.getState().jumpTo(6));

    act(() => {
      usePlayerStore.getState().play();
      usePlayerStore.getState().advanceBy(1);
    });
    expect(usePlayerStore.getState().currentStep).toBe(7);

    act(() => usePlayerStore.getState().jumpTo(10));
    act(() => usePlayerStore.getState().setLoopScope({ start: 6, end: 10 }));
    act(() => {
      usePlayerStore.getState().play();
      usePlayerStore.getState().advanceBy(1);
    });
    expect(usePlayerStore.getState().currentStep).toBe(6);
  });
});
