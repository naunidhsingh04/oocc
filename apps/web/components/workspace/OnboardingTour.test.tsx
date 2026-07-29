import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { hasTourBeenSeen } from "@/lib/onboarding/store";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { OnboardingTour } from "./OnboardingTour";

beforeEach(() => {
  window.localStorage.clear();
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

describe("OnboardingTour", () => {
  it("stays hidden until a real trace is loaded, then shows step 1 of 4", async () => {
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("advances through all four steps and marks itself seen on Done", async () => {
    const user = userEvent.setup();
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    render(<OnboardingTour />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    for (const label of ["2 / 4", "3 / 4", "4 / 4"]) {
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hasTourBeenSeen()).toBe(true);
  });

  it("skipping marks it seen and never shows it again on remount", async () => {
    const user = userEvent.setup();
    const { trace, source } = loadFixture("binary_search");
    act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));

    const { unmount } = render(<OnboardingTour />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /skip tour/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
