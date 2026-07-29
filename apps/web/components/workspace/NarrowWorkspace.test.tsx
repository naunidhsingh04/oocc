import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { NarrowWorkspace } from "./NarrowWorkspace";

beforeEach(() => {
  act(() => {
    usePlayerStore.setState({
      trace: null,
      sourceCode: "",
      fixtureName: null,
      currentStep: 0,
      playing: false,
      breakpoints: new Set(),
      loopScope: null,
      channels: new Map(),
      loopBrackets: [],
      ticks: [],
    });
  });
});

describe("NarrowWorkspace", () => {
  it("shows Code/Visual/Tutor tabs with the ribbon and playback bar always mounted", async () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    render(<NarrowWorkspace />);

    expect(screen.getByRole("tab", { name: "Code" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Visual" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tutor" })).toBeInTheDocument();

    // The ribbon (an accessible slider) is pinned regardless of active tab.
    expect(screen.getByRole("slider", { name: /trace ribbon/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(document.body.textContent).toContain("def binary_search");
    });
  });

  it("switches to the Tutor tab and still shows the pinned ribbon", async () => {
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const user = userEvent.setup();
    render(<NarrowWorkspace />);

    await user.click(screen.getByRole("tab", { name: "Tutor" }));

    expect(screen.getByTestId("tutor-transcript")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /trace ribbon/i })).toBeInTheDocument();
  });
});
