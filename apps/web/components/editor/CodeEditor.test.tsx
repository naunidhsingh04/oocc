import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { CodeEditor } from "./CodeEditor";

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({
      trace: null,
      sourceCode: "",
      fixtureName: null,
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

describe("CodeEditor", () => {
  it("renders the fixture's source and highlights the current line", async () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { container } = render(<CodeEditor />);

    await waitFor(() => {
      expect(container.textContent).toContain("def binary_search");
    });

    act(() => usePlayerStore.getState().jumpTo(6)); // while lo <= hi: — line 3
    await waitFor(() => {
      expect(container.querySelector(".cm-oocc-current-line")).not.toBeNull();
    });
  });

  it("toggles a breakpoint in the store when the gutter is clicked", async () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { container } = render(<CodeEditor />);
    await waitFor(() => {
      expect(container.querySelector(".cm-oocc-breakpoint-gutter")).not.toBeNull();
    });

    const gutterElement = container.querySelector(".cm-oocc-breakpoint-gutter .cm-gutterElement:nth-child(2)");
    expect(gutterElement).not.toBeNull();

    act(() => {
      gutterElement!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(usePlayerStore.getState().breakpoints.has(1)).toBe(true);
  });
});
