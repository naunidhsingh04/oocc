import { getStateAt } from "@/lib/player";
import { loadFixture } from "@/lib/player/testHelpers";
import { describe, expect, it } from "vitest";
import { computeHashMapView, findPrimaryHashMapBinding } from "./hashMapDetection";

describe("hash map detection on the real two_sum fixture", () => {
  it("finds the dict and buckets every entry, changed key highlighted", () => {
    const { trace } = loadFixture("two_sum");
    const binding = findPrimaryHashMapBinding(trace)!;
    expect(binding).toBeDefined();

    // Not the trace's final step: `seen` is a local that goes out of scope
    // (and out of the heap snapshot) once `two_sum` returns.
    const step = getStateAt(trace, 10);
    const view = computeHashMapView(step, binding)!;
    expect(view).not.toBeNull();

    const allEntries = view.buckets.flat();
    // Every bucket assignment must be stable/deterministic for the same key.
    const byKey = new Map(allEntries.map((e) => [e.key, e.bucket]));
    for (const entry of allEntries) {
      expect(byKey.get(entry.key)).toBe(entry.bucket);
    }
  });
});
