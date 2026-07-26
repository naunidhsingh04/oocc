import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeConsoleLines } from "./consoleDetection";

describe("computeConsoleLines", () => {
  it("splits binary_search's single print into a line tagged with the step that printed it", () => {
    const { trace } = loadFixture("binary_search");
    const lines = computeConsoleLines(trace);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]!.text).toContain("index:");
    expect(lines[0]!.stepIndex).toBeGreaterThan(0);
    expect(lines[0]!.stepIndex).toBeLessThan(trace.steps.length);
  });

  it("returns no lines for a program that never prints anything", () => {
    const { trace } = loadFixture("infinite_loop");
    const lines = computeConsoleLines(trace);
    expect(lines).toHaveLength(0);
  });
});
