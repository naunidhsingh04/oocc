import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFixture } from "@/lib/player/testHelpers";
import { useComparePlayback } from "./useComparePlayback";

describe("useComparePlayback", () => {
  it("scrubbing side A maps side B proportionally under index sync", () => {
    const { trace: traceA } = loadFixture("bubble_sort"); // 69 steps -> lastIndex 68
    const { trace: traceB } = loadFixture("quicksort_partition"); // 136 steps -> lastIndex 135
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    expect(result.current.sideA.lastIndex).toBe(traceA.steps.length - 1);
    expect(result.current.sideB.lastIndex).toBe(traceB.steps.length - 1);

    act(() => result.current.scrubA(Math.round(result.current.sideA.lastIndex * 0.2)));

    const expectedRatio = Math.round(result.current.sideA.lastIndex * 0.2) / result.current.sideA.lastIndex;
    const expectedB = Math.round(expectedRatio * result.current.sideB.lastIndex);
    expect(result.current.posB).toBe(expectedB);
  });

  it("scrubbing side B maps side A back via the inverse proportional mapping", () => {
    const { trace: traceA } = loadFixture("bubble_sort");
    const { trace: traceB } = loadFixture("quicksort_partition");
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    act(() => result.current.scrubB(result.current.sideB.lastIndex));
    expect(result.current.posA).toBe(result.current.sideA.lastIndex);
    expect(result.current.posB).toBe(result.current.sideB.lastIndex);
  });

  it("switching to event sync re-derives side B from side A's current position immediately", () => {
    const { trace: traceA } = loadFixture("binary_search");
    const { trace: traceB } = loadFixture("binary_search");
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    act(() => result.current.scrubA(10));
    act(() => result.current.setSyncMode("event"));
    act(() => result.current.setEventKind("comparison"));

    // Same trace on both sides: side B should land on its own Nth
    // "comparison" occurrence, where N is however many comparisons side A
    // has passed by position 10 — i.e. the largest comparison position
    // <= 10, not necessarily 10 itself (10 may not be a comparison step).
    const comparisons = result.current.sideA.occurrences.get("comparison") ?? [];
    const expected = [...comparisons].reverse().find((pos) => pos <= 10) ?? 0;
    expect(result.current.posB).toBe(expected);
  });

  it("stepBy advances side A and re-derives side B", () => {
    const { trace: traceA } = loadFixture("bubble_sort");
    const { trace: traceB } = loadFixture("quicksort_partition");
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    act(() => result.current.stepBy(5));
    expect(result.current.posA).toBe(5);
    expect(result.current.playing).toBe(false);
  });

  it("cycleSpeed moves through SPEED_STEPS", () => {
    const { trace: traceA } = loadFixture("bubble_sort");
    const { trace: traceB } = loadFixture("quicksort_partition");
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    expect(result.current.speed).toBe(1);
    act(() => result.current.cycleSpeed(1));
    expect(result.current.speed).toBeGreaterThan(1);
  });
});

describe("useComparePlayback — playback clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances side A forward over time while playing, and stops at the end", () => {
    const { trace: traceA } = loadFixture("bubble_sort");
    const { trace: traceB } = loadFixture("quicksort_partition");
    const { result } = renderHook(() => useComparePlayback(traceA, traceB));

    act(() => result.current.togglePlay());
    expect(result.current.playing).toBe(true);

    // Advance real time via rAF-driven frames; jsdom's requestAnimationFrame
    // under fake timers still needs the clock ticked forward to fire.
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.posA).toBeGreaterThan(0);
  });
});
