import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { useCommandRegistry } from "./commands";
import { usePlayerStore } from "./player";
import { loadFixture } from "./player/testHelpers";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({ trace: null, currentStep: 0, playing: false, fixtureName: null });
  });
});

describe("useCommandRegistry", () => {
  it("offers appearance and fixture commands even with no trace loaded", () => {
    const { result } = renderHook(() => useCommandRegistry(), { wrapper });
    const groups = new Set(result.current.map((c) => c.group));
    expect(groups.has("Appearance")).toBe(true);
    expect(groups.has("Fixtures")).toBe(true);
    expect(groups.has("Playback")).toBe(false);
  });

  it("adds real, working playback commands once a trace is loaded", () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { result } = renderHook(() => useCommandRegistry(), { wrapper });
    const stepForward = result.current.find((c) => c.id === "playback.step-forward");
    expect(stepForward).toBeDefined();

    act(() => stepForward!.onSelect());
    expect(usePlayerStore.getState().currentStep).toBe(1);
  });

  it("labels the toggle command by current playback state", () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { result, rerender } = renderHook(() => useCommandRegistry(), { wrapper });
    expect(result.current.find((c) => c.id === "playback.toggle")?.label).toBe("Play");

    act(() => usePlayerStore.getState().play());
    rerender();
    expect(result.current.find((c) => c.id === "playback.toggle")?.label).toBe("Pause");
  });
});
