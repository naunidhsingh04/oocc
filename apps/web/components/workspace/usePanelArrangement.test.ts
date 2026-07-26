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

  it("clears maximizedId when the maximized panel is removed", () => {
    const { result } = renderHook(() => usePanelArrangement(PLAN, "test-key-3"));
    act(() => result.current.setMaximizedId("p1"));
    expect(result.current.maximizedId).toBe("p1");
    act(() => result.current.removePanel("p1"));
    expect(result.current.maximizedId).toBeNull();
  });
});
