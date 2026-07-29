import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("renders no header when title is omitted", () => {
    render(<Panel>content</Panel>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders a UI-typeface header with the given title and actions", () => {
    render(
      <Panel title="Variables" actions={<button type="button">Clear</button>}>
        content
      </Panel>,
    );
    const heading = screen.getByRole("heading", { name: "Variables" });
    expect(heading).toHaveClass("font-body", "font-semibold");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
