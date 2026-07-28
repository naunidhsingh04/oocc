import { describe, expect, it } from "vitest";
import { buildChannelAssignment } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import {
  computeEventOccurrences,
  countAtOrBefore,
  mapPositionByEvent,
  mapPositionProportional,
} from "./eventOccurrences";

describe("computeEventOccurrences", () => {
  it("classifies binary_search's steps using the same categories the ribbon ticks use", () => {
    const { trace } = loadFixture("binary_search");
    const channels = buildChannelAssignment(trace);
    const occurrences = computeEventOccurrences(trace, channels);

    const call = occurrences.get("call") ?? [];
    const comparison = occurrences.get("comparison") ?? [];
    const assignment = occurrences.get("assignment") ?? [];

    expect(call.length).toBeGreaterThan(0);
    expect(comparison.length).toBeGreaterThan(0);
    expect(assignment.length).toBeGreaterThan(0);
    // Every occurrence list is sorted ascending array positions.
    for (const list of [call, comparison, assignment]) {
      for (let i = 1; i < list.length; i += 1) {
        expect(list[i]).toBeGreaterThan(list[i - 1]!);
      }
    }
  });

  it("finds loop iteration starts translated from step.i to array position", () => {
    const { trace } = loadFixture("binary_search");
    const channels = buildChannelAssignment(trace);
    const occurrences = computeEventOccurrences(trace, channels);
    const loopIteration = occurrences.get("loop_iteration") ?? [];

    // binary_search's while loop runs 4 times (loops.test.ts already
    // regression-tests the iterationStarts themselves at step.i 6/11/16/21).
    expect(loopIteration.length).toBe(4);
    for (const pos of loopIteration) {
      expect(trace.steps[pos]).toBeDefined();
    }
  });
});

describe("countAtOrBefore", () => {
  it("counts sorted entries <= pos", () => {
    const sorted = [2, 5, 9, 20];
    expect(countAtOrBefore(sorted, 1)).toBe(0);
    expect(countAtOrBefore(sorted, 2)).toBe(1);
    expect(countAtOrBefore(sorted, 8)).toBe(2);
    expect(countAtOrBefore(sorted, 20)).toBe(4);
    expect(countAtOrBefore(sorted, 100)).toBe(4);
  });
});

describe("mapPositionProportional", () => {
  it("maps 20% of one run to 20% of another, not a raw clamp", () => {
    // A 45-step run and a 9-step run: at 20% through the long run (step 9 of
    // 45 - 1 = 44), the short run should land near its own 20% mark (step
    // ~1.6 of 8), not at step 9 (which would overshoot a 9-long array).
    expect(mapPositionProportional(9, 44, 8)).toBe(2);
    expect(mapPositionProportional(0, 44, 8)).toBe(0);
    expect(mapPositionProportional(44, 44, 8)).toBe(8);
  });

  it("degrades to 0 for a zero-length source run instead of dividing by zero", () => {
    expect(mapPositionProportional(0, 0, 10)).toBe(0);
  });
});

describe("mapPositionByEvent", () => {
  it("jumps to the Nth occurrence of the same rank in the target trace", () => {
    const sourceMatches = [3, 7, 12, 20];
    const targetMatches = [1, 2, 3];

    // Position 12 is the 3rd occurrence in source (indices 3,7,12 <= 12) -> target's 3rd occurrence.
    expect(mapPositionByEvent(sourceMatches, targetMatches, 12, 30, 30)).toBe(3);
    // Before any occurrence -> start.
    expect(mapPositionByEvent(sourceMatches, targetMatches, 0, 30, 30)).toBe(0);
    // Past the target's own occurrence count -> clamp to target's last occurrence.
    expect(mapPositionByEvent(sourceMatches, targetMatches, 20, 30, 30)).toBe(3);
  });

  it("falls back to proportional index sync when an event never occurs in either trace", () => {
    expect(mapPositionByEvent([], [1, 2, 3], 10, 40, 30)).toBe(mapPositionProportional(10, 40, 30));
    expect(mapPositionByEvent([1, 2, 3], [], 10, 40, 30)).toBe(mapPositionProportional(10, 40, 30));
  });
});
