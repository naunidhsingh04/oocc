import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockUseTheme = vi.mocked(useTheme);

describe("ThemeToggle", () => {
  it("switches to dark when currently light", async () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      setTheme,
      themes: ["light", "dark"],
    });
    const user = userEvent.setup();

    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: "Switch to dark mode" });
    await user.click(button);

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches to light when currently dark", async () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({
      resolvedTheme: "dark",
      setTheme,
      themes: ["light", "dark"],
    });
    const user = userEvent.setup();

    render(<ThemeToggle />);
    const button = await screen.findByRole("button", { name: "Switch to light mode" });
    await user.click(button);

    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
