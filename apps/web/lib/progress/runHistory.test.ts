import { beforeEach, describe, expect, it } from "vitest";
import type { TickInfo } from "@/lib/player";
import { downsampleTicks, getRunHistory, recordRun } from "./runHistory";
import type { Trace } from "@oocc/contracts";

function makeTicks(n: number): TickInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    category: i % 7 === 0 ? "call" : "comparison",
    depth: 0,
  }));
}

function makeTrace(stepCount: number, overrides: Partial<Trace> = {}): Trace {
  return {
    schema_version: "1.0",
    run_id: "r_test",
    language: "python",
    source_hash: `sha_${stepCount}_${JSON.stringify(overrides)}`,
    status: "ok",
    meta: { duration_ms: 1, step_count: stepCount, truncated: false },
    steps: Array.from({ length: stepCount }, (_, i) => ({
      i,
      event: "line",
      line: 1,
      func: "main",
      depth: 0,
      stack: [],
      heap: {},
      stdout_delta: "",
      changed: [],
    })),
    ...overrides,
  } as unknown as Trace;
}

describe("downsampleTicks", () => {
  it("returns ticks unchanged when already within the cap", () => {
    const ticks = makeTicks(50);
    expect(downsampleTicks(ticks, 240)).toEqual(ticks);
  });

  it("shrinks a large tick array down to at most maxLen entries", () => {
    const ticks = makeTicks(10000);
    const result = downsampleTicks(ticks, 200);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.length).toBeGreaterThan(0);
  });

  it("prefers a higher-priority event (call) over comparison within a bucket", () => {
    const ticks: TickInfo[] = [
      { category: "comparison", depth: 0 },
      { category: "comparison", depth: 0 },
      { category: "call", depth: 0 },
      { category: "comparison", depth: 0 },
    ];
    const result = downsampleTicks(ticks, 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.category).toBe("call");
  });
});

describe("recordRun / getRunHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty", () => {
    expect(getRunHistory()).toEqual([]);
  });

  it("records a run and makes it retrievable, most recent first", () => {
    recordRun({ trace: makeTrace(5, { source_hash: "s1" }), name: "run-a", channels: new Map() });
    recordRun({ trace: makeTrace(8, { source_hash: "s2" }), name: "run-b", channels: new Map() });
    const history = getRunHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.name).toBe("run-b");
    expect(history[1]!.name).toBe("run-a");
  });

  it("dedupes an immediate repeat of the same name/status/stepCount", () => {
    const trace = makeTrace(5, { source_hash: "s1" });
    recordRun({ trace, name: "run-a", channels: new Map() });
    recordRun({ trace, name: "run-a", channels: new Map() });
    expect(getRunHistory()).toHaveLength(1);
  });

  it("stores a downsampled tick array, not the raw per-step count", () => {
    const trace = makeTrace(5000, { source_hash: "s1" });
    recordRun({ trace, name: "big-run", channels: new Map() });
    const [entry] = getRunHistory();
    expect(entry!.ticks.length).toBeLessThan(5000);
  });
});
