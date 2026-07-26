import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no real layout engine, so CodeMirror 6's measurement pass
// (line heights, character positions) has nothing to call. Stub the two
// methods it touches with zeroed rects instead of leaving them undefined —
// without this, every test that mounts a CodeEditor throws from inside a
// requestAnimationFrame callback.
const zeroRect: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON() {
    return this;
  },
};

function emptyRectList(): DOMRectList {
  return {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {
      /* empty */
    },
  } as unknown as DOMRectList;
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = emptyRectList;
}
Range.prototype.getBoundingClientRect = () => zeroRect;
Element.prototype.getClientRects = emptyRectList;

// jsdom doesn't implement ResizeObserver at all; components that size a
// canvas off their container (the trace ribbon) only need the constructor
// to exist in tests that don't assert on layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no matchMedia; next-themes' ThemeProvider checks it on mount to
// resolve the "system" theme.
if (typeof window.matchMedia === "undefined") {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
