import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement ResizeObserver; cmdk (CommandPalette) uses it to
// size its results list. A no-op is enough for tests — nothing here
// exercises the resulting layout math.
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only jsdom global polyfill
(globalThis as any).ResizeObserver ??= ResizeObserverMock;

// jsdom doesn't implement scrollIntoView either; cmdk calls it to keep the
// selected item visible as you arrow through results.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only jsdom prototype polyfill
(Element.prototype as any).scrollIntoView ??= () => {};
