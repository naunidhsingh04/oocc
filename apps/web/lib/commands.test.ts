import { describe, expect, it } from "vitest";
import { commandRegistry } from "./commands";

describe("commandRegistry", () => {
  it("is empty in Phase 0 — the palette is wired up, but nothing registers commands yet", () => {
    expect(commandRegistry).toEqual([]);
  });
});
