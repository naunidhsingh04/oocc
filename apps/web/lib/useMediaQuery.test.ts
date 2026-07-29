import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

describe("useMediaQuery", () => {
  let listeners: Array<() => void>;
  let matches: boolean;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    listeners = [];
    matches = false;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("reflects the current match state and updates on change", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);

    matches = true;
    act(() => {
      listeners.forEach((l) => l());
    });
    expect(result.current).toBe(true);
  });
});
