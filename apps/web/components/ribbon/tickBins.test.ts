import { describe, expect, it } from "vitest";
import type { TickInfo } from "@/lib/player";
import { computeTickBins, stepToX, xToStep } from "./tickBins";

function makeTicks(n: number): TickInfo[] {
  return Array.from({ length: n }, (_, i) => ({ category: "comparison" as const, depth: i % 3 }));
}

describe("computeTickBins", () => {
  it("gives every step its own tick when there is room", () => {
    const bins = computeTickBins(makeTicks(50), 1200);
    expect(bins).toHaveLength(50);
    expect(bins.every((b) => b.stepStart === b.stepEnd)).toBe(true);
  });

  it("aggregates steps into pixel columns once there are more steps than pixels, and stays bounded by width", () => {
    const bins = computeTickBins(makeTicks(40_000), 1600);
    expect(bins.length).toBeLessThanOrEqual(1600);

    // Every step must fall in exactly one bin's range, in order, with no gaps.
    let expectedNext = 0;
    for (const bin of bins) {
      expect(bin.stepStart).toBe(expectedNext);
      expect(bin.stepEnd).toBeGreaterThanOrEqual(bin.stepStart);
      expectedNext = bin.stepEnd + 1;
    }
    expect(expectedNext).toBe(40_000);
  });

  it("prioritizes exception/call over comparison ticks inside a bin", () => {
    const ticks: TickInfo[] = makeTicks(10);
    ticks[5] = { category: "exception", depth: 0 };
    const bins = computeTickBins(ticks, 2); // forces all 10 steps into 2 bins
    const binWithException = bins.find((b) => b.stepStart <= 5 && b.stepEnd >= 5);
    expect(binWithException?.category).toBe("exception");
  });

  it("returns nothing for an empty trace", () => {
    expect(computeTickBins([], 1200)).toEqual([]);
  });
});

describe("stepToX / xToStep", () => {
  it("round-trips step -> pixel -> step", () => {
    const stepCount = 1840;
    const width = 900;
    for (const step of [0, 1, 412, 1000, stepCount - 1]) {
      const x = stepToX(step, stepCount, width);
      expect(xToStep(x, stepCount, width)).toBe(step);
    }
  });

  it("clamps to valid range", () => {
    expect(xToStep(-50, 100, 900)).toBe(0);
    expect(xToStep(10_000, 100, 900)).toBe(99);
  });
});
