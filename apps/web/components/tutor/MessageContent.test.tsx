import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageContent } from "./MessageContent";

describe("MessageContent", () => {
  it("renders backtick-quoted identifiers as monospace code spans", () => {
    render(<MessageContent text="Because `mid` equals `4`." channels={new Map()} />);
    expect(screen.getByText("mid").tagName).toBe("CODE");
    expect(screen.getByText("4").tagName).toBe("CODE");
  });

  it("colors a code span by its channel when the identifier is a known variable", () => {
    render(<MessageContent text="`lo` and `hi` bracket it." channels={new Map([["lo", 3]])} />);
    const lo = screen.getByText("lo");
    expect(lo.style.color).toBe("var(--color-ch-3)");
    const hi = screen.getByText("hi");
    expect(hi.style.color).not.toBe("var(--color-ch-3)");
  });

  it("leaves plain prose outside backticks untouched", () => {
    render(<MessageContent text="No code here." channels={new Map()} />);
    expect(screen.getByText("No code here.").tagName).not.toBe("CODE");
  });
});
