import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);

describe("TopBar", () => {
  it("marks the current route as the active nav link", () => {
    mockUsePathname.mockReturnValue("/styleguide");
    render(<TopBar onOpenPalette={() => {}} />);

    expect(screen.getByRole("link", { name: "Styleguide" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("opens the command palette when the ⌘K trigger is clicked", async () => {
    mockUsePathname.mockReturnValue("/");
    const onOpenPalette = vi.fn();
    const user = userEvent.setup();

    render(<TopBar onOpenPalette={onOpenPalette} />);
    await user.click(screen.getByRole("button", { name: /⌘K/ }));

    expect(onOpenPalette).toHaveBeenCalledOnce();
  });
});
