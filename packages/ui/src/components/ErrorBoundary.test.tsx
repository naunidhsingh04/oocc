import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>fine</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>fine</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("catches a thrown render error and shows a contained fallback instead of propagating", () => {
    // React logs the error to console.error even inside a boundary —
    // silence it for this test only, the point being tested is that the
    // boundary itself doesn't propagate, not that nothing gets logged.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary title="Widget">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Widget ran into a problem");
    expect(screen.getByText("boom")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("calls onError exactly once with the thrown error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });

  it("retry clears the error and re-renders children with fresh props", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Fix the underlying condition, then retry — the boundary should
    // render the now-healthy children instead of staying stuck on the
    // stale error state.
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("fine")).toBeInTheDocument();
    spy.mockRestore();
  });
});
