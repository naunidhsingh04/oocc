import type { HeapObject, Step, Trace } from "@oocc/contracts";
import { describe, expect, it } from "vitest";
import { getStateAt } from "./getStateAt";
import { makeSyntheticTrace } from "./testHelpers";

function withHeap(step: Step, heap: Record<string, HeapObject>): Step {
  return { ...step, heap };
}

function withPatch(step: Step, patch: NonNullable<Step["heap_patch"]>): Step {
  const result: Step = { ...step, heap_patch: patch };
  delete result.heap;
  return result;
}

describe("getStateAt", () => {
  it("returns a legacy full-heap step unchanged (pre-Phase-6 trace shape)", () => {
    const trace = makeSyntheticTrace(5);
    const step = getStateAt(trace, 2);
    expect(step).toBe(trace.steps[2]);
  });

  it("reconstructs a non-keyframe step by walking back to the nearest keyframe", () => {
    const base = makeSyntheticTrace(4);
    const heapAtStep0: Record<string, HeapObject> = {
      o1: { type: "list", len: 3, items: [{ val: 1 }, { val: 2 }, { val: 3 }] },
    };

    const trace: Trace = {
      ...base,
      steps: [
        withHeap(base.steps[0]!, heapAtStep0),
        withPatch(base.steps[1]!, [{ op: "replace", path: "/o1/items/1/val", value: 20 }]),
        withPatch(base.steps[2]!, [{ op: "replace", path: "/o1/items/2/val", value: 30 }]),
        withHeap(base.steps[3]!, { o1: { type: "list", len: 2, items: [{ val: 1 }, { val: 20 }] } }),
      ],
    };

    expect(getStateAt(trace, 0)!.heap).toEqual({
      o1: { type: "list", len: 3, items: [{ val: 1 }, { val: 2 }, { val: 3 }] },
    });
    expect(getStateAt(trace, 1)!.heap).toEqual({
      o1: { type: "list", len: 3, items: [{ val: 1 }, { val: 20 }, { val: 3 }] },
    });
    expect(getStateAt(trace, 2)!.heap).toEqual({
      o1: { type: "list", len: 3, items: [{ val: 1 }, { val: 20 }, { val: 30 }] },
    });
    // step 3 is its own keyframe again — patches from steps 1-2 must not leak through.
    expect(getStateAt(trace, 3)!.heap).toEqual({
      o1: { type: "list", len: 2, items: [{ val: 1 }, { val: 20 }] },
    });
  });

  it("preserves every other field on a reconstructed step", () => {
    const base = makeSyntheticTrace(2);
    const trace: Trace = {
      ...base,
      steps: [
        withHeap(base.steps[0]!, { o1: { type: "opaque", repr: "x" } }),
        { ...withPatch(base.steps[1]!, []), changed: ["f0.i"], event: "return", returned: { val: 1 } },
      ],
    };

    const step = getStateAt(trace, 1)!;

    expect(step.changed).toEqual(["f0.i"]);
    expect(step.event).toBe("return");
    expect(step.returned).toEqual({ val: 1 });
    expect("heap_patch" in step).toBe(false);
  });

  it("does not mutate the trace's own keyframe heap across repeated reconstructions", () => {
    const base = makeSyntheticTrace(3);
    const trace: Trace = {
      ...base,
      steps: [
        withHeap(base.steps[0]!, { o1: { type: "list", len: 1, items: [{ val: 1 }] } }),
        withPatch(base.steps[1]!, [{ op: "replace", path: "/o1/items/0/val", value: 2 }]),
        withPatch(base.steps[2]!, [{ op: "replace", path: "/o1/items/0/val", value: 3 }]),
      ],
    };

    getStateAt(trace, 1);
    getStateAt(trace, 2);
    const keyframeHeapAfter = trace.steps[0]!.heap;

    expect(keyframeHeapAfter).toEqual({ o1: { type: "list", len: 1, items: [{ val: 1 }] } });
  });

  it("returns a stable reference for repeated calls with the same trace and index", () => {
    const base = makeSyntheticTrace(2);
    const trace: Trace = {
      ...base,
      steps: [
        withHeap(base.steps[0]!, { o1: { type: "opaque", repr: "x" } }),
        withPatch(base.steps[1]!, []),
      ],
    };

    const first = getStateAt(trace, 1);
    const second = getStateAt(trace, 1);

    expect(first).toBe(second);
  });
});
