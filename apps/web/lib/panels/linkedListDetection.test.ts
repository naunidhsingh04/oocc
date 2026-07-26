import { getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeLinkedListView, findPrimaryLinkedListRoot } from "./linkedListDetection";

describe("findPrimaryLinkedListRoot", () => {
  it("finds the ListNode chain in linked_list_reversal by shape, not by class name", () => {
    const { trace } = loadFixture("linked_list_reversal");
    expect(findPrimaryLinkedListRoot(trace)).toBeDefined();
  });
});

describe("computeLinkedListView", () => {
  it("walks the whole chain to null with no cycle on a real trace", () => {
    const { trace } = loadFixture("linked_list_reversal");
    const root = findPrimaryLinkedListRoot(trace)!;
    const lastStep = getStateAt(trace, trace.steps.length - 1);
    const view = computeLinkedListView(trace, lastStep, root);

    expect(view).not.toBeNull();
    expect(view!.hasCycle).toBe(false);
    expect(view!.nodes.length).toBeGreaterThan(0);
    expect(view!.nodes[view!.nodes.length - 1]!.nextRef).toBeNull();
  });

  it("detects a synthetic cycle instead of hanging", () => {
    const trace = {
      schema_version: "1.0",
      run_id: "r_test",
      language: "python" as const,
      source_hash: `sha256:${"0".repeat(64)}`,
      status: "ok" as const,
      meta: { duration_ms: 1, step_count: 1, truncated: false, stdin: "", peak_heap_objects: 2 },
      steps: [
        {
          i: 0,
          event: "line" as const,
          line: 1,
          func: "<module>",
          depth: 0,
          stack: [{ frame_id: "f0", func: "<module>", line: 1, locals: {} }] as [
            { frame_id: string; func: string; line: number; locals: Record<string, never> },
          ],
          heap: {
            o1: { type: "Node", fields: { next: { ref: "o2" } } },
            o2: { type: "Node", fields: { next: { ref: "o1" } } },
          },
          stdout_delta: "",
          changed: [],
        },
      ],
    };
    const view = computeLinkedListView(trace, trace.steps[0], "o1");
    expect(view).not.toBeNull();
    expect(view!.hasCycle).toBe(true);
    expect(view!.nodes.length).toBeLessThanOrEqual(2);
  });
});
