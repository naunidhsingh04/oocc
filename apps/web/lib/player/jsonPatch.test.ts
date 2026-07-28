import { describe, expect, it } from "vitest";
import { applyJsonPatch, type JsonPatchOp } from "./jsonPatch";

describe("applyJsonPatch", () => {
  it("replaces a nested scalar", () => {
    const doc = { o1: { type: "list", items: [{ val: 1 }, { val: 2 }] } };
    const patch: JsonPatchOp[] = [{ op: "replace", path: "/o1/items/1/val", value: 9 }];

    applyJsonPatch(doc, patch);

    expect(doc).toEqual({ o1: { type: "list", items: [{ val: 1 }, { val: 9 }] } });
  });

  it("adds and removes object keys", () => {
    const doc: Record<string, unknown> = { a: 1, b: 2 };
    const patch: JsonPatchOp[] = [
      { op: "remove", path: "/a" },
      { op: "add", path: "/c", value: 3 },
    ];

    applyJsonPatch(doc, patch);

    expect(doc).toEqual({ b: 2, c: 3 });
  });

  it("appends to an array via add at the end index", () => {
    const doc = { items: [1, 2, 3] };
    const patch: JsonPatchOp[] = [
      { op: "add", path: "/items/3", value: 4 },
      { op: "add", path: "/items/4", value: 5 },
    ];

    applyJsonPatch(doc, patch);

    expect(doc.items).toEqual([1, 2, 3, 4, 5]);
  });

  it("removes trailing array elements highest-index-first", () => {
    const doc = { items: [1, 2, 3, 4, 5] };
    const patch: JsonPatchOp[] = [
      { op: "remove", path: "/items/4" },
      { op: "remove", path: "/items/3" },
    ];

    applyJsonPatch(doc, patch);

    expect(doc.items).toEqual([1, 2, 3]);
  });

  it("unescapes ~1 and ~0 in path tokens", () => {
    const doc: Record<string, unknown> = { "a/b": 1, "c~d": 2 };
    const patch: JsonPatchOp[] = [{ op: "replace", path: "/a~1b", value: 9 }];

    applyJsonPatch(doc, patch);

    expect(doc["a/b"]).toBe(9);
  });
});
