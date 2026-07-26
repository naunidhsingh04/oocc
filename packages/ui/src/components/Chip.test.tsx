import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("applies a semantic tone class when no channel is given", () => {
    render(<Chip tone="mutate">changed</Chip>);
    expect(screen.getByText("changed")).toHaveClass("border-mutate", "text-mutate");
  });

  it("binds to the channel color token instead of a tone class when channel is set", () => {
    render(<Chip channel={3}>lo</Chip>);
    const chip = screen.getByText("lo");
    // jsdom's CSSOM doesn't reliably round-trip var()-valued longhand
    // border-color through toHaveStyle, so check the serialized style
    // attribute directly: both border and text color should reference ch-3.
    const style = chip.getAttribute("style") ?? "";
    expect(style.match(/var\(--color-ch-3\)/g)).toHaveLength(2);
    expect(chip.className).not.toContain("border-mutate");
  });

  it("renders a color-dot swatch for channel chips", () => {
    const { container } = render(<Chip channel={5}>hi</Chip>);
    const dot = container.querySelector("span > span");
    expect(dot).toHaveStyle({ backgroundColor: "var(--color-ch-5)" });
  });
});
