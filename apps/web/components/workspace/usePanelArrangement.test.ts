import { act, renderHook } from "@testing-library/react";
import type { VizPlan } from "@oocc/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { usePanelArrangement } from "./usePanelArrangement";

const PLAN: VizPlan = {
  layout: "primary+stack",
  panels: [
    { id: "p1", type: "array", binding: "o1", role: "primary" },
    { id: "p2", type: "call_stack", role: "secondary" },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("usePanelArrangement", () => {
  it("seeds panels from the plan", () => {
    const { result } = renderHook(() => usePanelArrangement(PLAN, "test-key"));
    expect(result.current.panels).toEqual(PLAN.panels);
    expect(result.current.layout).toBe("primary+stack");
  });

  it("falls back to the default two-panel plan when no plan is given", () => {
    const { result } = renderHook(() => usePanelArrangement(null, "test-key-none"));
    expect(result.current.panels.map((p) => p.type)).toEqual(["call_stack", "variables"]);
  });

  it("add/remove/retype mutate the working panel list", () => {
    const { result } = renderHook(() => usePanelArrangement(PLAN, "test-key-2"));

    act(() => result.current.addPanel("timeline"));
    expect(result.current.panels.some((p) => p.type === "timeline")).toBe(true);

    const addedId = result.current.panels.find((p) => p.type === "timeline")!.id;
    act(() => result.current.retypePanel(addedId, "console"));
    expect(result.current.panels.find((p) => p.id === addedId)!.type).toBe("console");

    act(() => result.current.removePanel("p2"));
    expect(result.current.panels.some((p) => p.id === "p2")).toBe(false);
  });

  it("persists arrangement to localStorage keyed by storageKey, and restores it", () => {
    const { result, unmount } = renderHook(() => usePanelArrangement(PLAN, "persist-key"));
    act(() => result.current.addPanel("console"));
    const afterAdd = result.current.panels;
    unmount();

    const { result: remounted } = renderHook(() => usePanelArrangement(PLAN, "persist-key"));
    expect(remounted.current.panels).toEqual(afterAdd);
  });

  it("re-seeds from the plan when the storage key changes, not carrying over the old arrangement", () => {
    const { result, rerender } = renderHook(({ key }) => usePanelArrangement(PLAN, key), {
      initialProps: { key: "run-a" },
    });
    act(() => result.current.addPanel("console"));
    expect(result.current.panels.some((p) => p.type === "console")).toBe(true);

    rerender({ key: "run-b" });
    expect(result.current.panels).toEqual(PLAN.panels);
  });

  it("never reassigns an existing local-N id after a fresh mount restores a persisted arrangement", () => {
    // Simulates a real page reload: the hook's own module state doesn't
    // carry over (a brand-new renderHook stands in for that), but
    // localStorage does. A counter that only lived in memory would reset
    // to `local-1` here and collide with the one already persisted —
    // exactly the bug that crashed `/play` in production with
    // `react-resizable-panels`' "Panel ids must be unique."
    const { result: first, unmount } = renderHook(() => usePanelArrangement(PLAN, "reload-key"));
    act(() => first.current.addPanel("console"));
    expect(first.current.panels.some((p) => p.id === "local-1")).toBe(true);
    unmount();

    const { result: second } = renderHook(() => usePanelArrangement(PLAN, "reload-key"));
    act(() => second.current.addPanel("timeline"));

    const ids = second.current.panels.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("local-1");
    expect(ids).toContain("local-2");
  });

  it("repairs an already-corrupted stored arrangement instead of crashing on load", () => {
    // A browser that hit the collision bug *before* the fix above has a
    // real duplicate-id arrangement already sitting in its own
    // localStorage — restoring it verbatim would reproduce the exact same
    // `react-resizable-panels` crash on the very next page load, with no
    // `addPanel` call involved. This is the recovery path for that
    // already-corrupted data, not just prevention of new corruption.
    window.localStorage.setItem(
      "oocc.panel-arrangement.corrupt-key",
      JSON.stringify({
        panels: [
          { id: "p1", type: "array", binding: "o1", role: "primary" },
          { id: "local-1", type: "console", role: "secondary" },
          { id: "local-1", type: "stack", role: "secondary" },
        ],
      }),
    );

    const { result } = renderHook(() => usePanelArrangement(PLAN, "corrupt-key"));
    const ids = result.current.panels.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.current.panels).toHaveLength(3);
    expect(result.current.panels.map((p) => p.type)).toEqual(["array", "console", "stack"]);
  });

  it("clears maximizedId when the maximized panel is removed", () => {
    const { result } = renderHook(() => usePanelArrangement(PLAN, "test-key-3"));
    act(() => result.current.setMaximizedId("p1"));
    expect(result.current.maximizedId).toBe("p1");
    act(() => result.current.removePanel("p1"));
    expect(result.current.maximizedId).toBeNull();
  });
});
