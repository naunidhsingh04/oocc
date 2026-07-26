import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("requires and exposes an accessible name via aria-label", () => {
    render(<IconButton aria-label="Toggle theme">*</IconButton>);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("marks the active state with data-active for styling", () => {
    render(
      <IconButton aria-label="Light mode" active>
        *
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-active");
  });

  it("has no data-active attribute when inactive", () => {
    render(<IconButton aria-label="Light mode">*</IconButton>);
    expect(screen.getByRole("button")).not.toHaveAttribute("data-active");
  });
});
