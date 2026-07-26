import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { TraceRibbon } from "./TraceRibbon";

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

function stubRect(canvas: HTMLCanvasElement, width: number) {
  canvas.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: 96, width, height: 96, toJSON: () => ({}) }) as DOMRect;
}

describe("TraceRibbon", () => {
  it("jumps to the step under the click position", () => {
    const { trace, source } = loadFixture("binary_search"); // 31 steps
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { container } = render(<TraceRibbon />);
    const canvas = container.querySelector("canvas")!;
    stubRect(canvas, 300);

    // Clicking at x=150 of 300px on a 31-step trace should land near the midpoint.
    act(() => {
      fireEvent.click(canvas, { clientX: 150, clientY: 80 });
    });

    const step = usePlayerStore.getState().currentStep;
    expect(step).toBeGreaterThan(10);
    expect(step).toBeLessThan(20);
  });

  it("scopes playback to a loop when a bracket is clicked", () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const brackets = usePlayerStore.getState().loopBrackets;
    expect(brackets.length).toBeGreaterThan(0);

    const { container } = render(<TraceRibbon />);
    const canvas = container.querySelector("canvas")!;
    stubRect(canvas, 300);

    // Click inside row 0's bracket band — draw.ts places it at
    // [bracketAreaHeight - 7, bracketAreaHeight] for a single-depth bracket.
    act(() => {
      fireEvent.click(canvas, { clientX: 150, clientY: 7 });
    });

    expect(usePlayerStore.getState().loopScope).toEqual({
      start: brackets[0]!.startStep,
      end: brackets[0]!.endStep,
    });
  });

  it("renders nothing hazardous with an empty store", () => {
    const { container } = render(<TraceRibbon />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
