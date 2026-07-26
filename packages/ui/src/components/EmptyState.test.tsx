import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title always, and description/action only when provided", () => {
    const { rerender } = render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <EmptyState
        title="No output yet"
        description="Panels reserve their space before a trace loads."
        action={<button type="button">Run</button>}
      />,
    );
    expect(screen.getByText("No output yet")).toBeInTheDocument();
    expect(screen.getByText("Panels reserve their space before a trace loads.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });
});
