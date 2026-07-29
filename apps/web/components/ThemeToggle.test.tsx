import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

function renderPicker() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("opens a list of all five presets and switches on selection", async () => {
    const user = userEvent.setup();
    renderPicker();

    const trigger = await screen.findByRole("button", { name: /Theme: Paper/ });
    await user.click(trigger);

    expect(screen.getByRole("option", { name: "Slate" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Midnight" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sepia" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mist" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Slate" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("slate");
    expect(await screen.findByRole("button", { name: /Theme: Slate/ })).toBeInTheDocument();
  });

  it("closes on Escape without changing the theme", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByRole("button", { name: /Theme: Paper/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });
});
