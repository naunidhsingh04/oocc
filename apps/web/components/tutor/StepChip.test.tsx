import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { StepChip } from "./StepChip";

beforeEach(() => {
  const { trace, source } = loadFixture("binary_search");
  act(() => usePlayerStore.getState().loadTrace({ trace, source, name: "binary_search" }));
});

describe("StepChip", () => {
  it("scrubs the player to the real step it names and pulses the ribbon", async () => {
    const trace = usePlayerStore.getState().trace!;
    const targetStepRef = trace.steps[5]!.i;
    render(<StepChip stepRef={targetStepRef} />);

    await userEvent.click(screen.getByTestId(`step-chip-${targetStepRef}`));

    expect(usePlayerStore.getState().currentStep).toBe(5);
    expect(usePlayerStore.getState().pulseStep).toBe(5);
  });
});
