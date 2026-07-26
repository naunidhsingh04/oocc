import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette, type CommandItem } from "./CommandPalette";

describe("CommandPalette", () => {
  it("renders nothing accessible when closed", () => {
    render(<CommandPalette commands={[]} open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the empty state for an empty registry (Phase 0: no commands yet)", () => {
    render(<CommandPalette commands={[]} open onOpenChange={() => {}} />);
    expect(screen.getByText("No matching commands.")).toBeInTheDocument();
  });

  it("renders commands grouped, ungrouped ones falling back to a default group", () => {
    const commands: CommandItem[] = [
      { id: "run", label: "Run", group: "Run", onSelect: () => {} },
      { id: "misc", label: "Do a thing", onSelect: () => {} },
    ];
    render(<CommandPalette commands={commands} open onOpenChange={() => {}} />);

    expect(screen.getByText("Run", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByText("Commands", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByText("Run", { selector: "[cmdk-item] span" })).toBeInTheDocument();
    expect(screen.getByText("Do a thing")).toBeInTheDocument();
  });

  it("calls onSelect and closes the palette when a command is chosen", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const commands: CommandItem[] = [{ id: "run", label: "Run trace", onSelect }];
    render(<CommandPalette commands={commands} open onOpenChange={onOpenChange} />);

    screen.getByText("Run trace").click();

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
