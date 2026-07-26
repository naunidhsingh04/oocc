import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children and responds to clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run</Button>);
    const button = screen.getByRole("button", { name: "Run" });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("is disabled and inert when disabled", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("asChild renders the child element instead of a <button>", () => {
    render(
      <Button asChild>
        <a href="/styleguide">Styleguide</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Styleguide" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/styleguide");
    // Button's own classes should still land on the rendered <a>.
    expect(link.className).toContain("rounded-control");
  });
});
