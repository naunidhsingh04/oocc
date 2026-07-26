import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function Example() {
  return (
    <Tabs defaultValue="array">
      <TabsList>
        <TabsTrigger value="array">Array</TabsTrigger>
        <TabsTrigger value="stack">Call stack</TabsTrigger>
      </TabsList>
      <TabsContent value="array">Array panel</TabsContent>
      <TabsContent value="stack">Call stack panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows the default tab's content and switches on click", async () => {
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.getByRole("tab", { name: "Array" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Array" })).toHaveTextContent("Array panel");

    await user.click(screen.getByRole("tab", { name: "Call stack" }));

    expect(screen.getByRole("tab", { name: "Call stack" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Array" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Call stack" })).toHaveTextContent("Call stack panel");
  });
});
