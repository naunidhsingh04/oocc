import type {
  HeapDict,
  HeapInstance,
  HeapList,
  HeapObject,
  HeapSet,
  Value,
} from "@oocc/contracts";

/**
 * Shared, trace-only value/heap helpers used by every panel's detection
 * module. `HeapInstance.type` is a bare `string` in the generated contract
 * (any user class name), so narrowing on the shape-only field
 * (`"items" in obj`, `"fields" in obj`, ...) is what actually excludes a
 * user class that happens to be named "list" — never trust `obj.type`
 * alone. See lib/panels/arrayDetection.ts for the original pattern.
 */

export function isHeapList(obj: HeapObject | undefined): obj is HeapList {
  return !!obj && obj.type === "list" && "items" in obj;
}

export function isHeapDict(obj: HeapObject | undefined): obj is HeapDict {
  return !!obj && obj.type === "dict" && "entries" in obj;
}

export function isHeapSet(obj: HeapObject | undefined): obj is HeapSet {
  return !!obj && obj.type === "set" && "items" in obj && !("entries" in obj);
}

/** A user-defined instance: has `fields`, and isn't one of the builtin shapes. */
export function isHeapInstance(obj: HeapObject | undefined): obj is HeapInstance {
  return !!obj && "fields" in obj;
}

export function refOf(value: Value): string | undefined {
  return value !== null && typeof value === "object" && "ref" in value ? value.ref : undefined;
}

export function isNoneValue(value: Value): boolean {
  return value === null || (typeof value === "object" && "val" in value && value.val === null);
}

export function inlineNumber(value: Value): number | null {
  if (value === null || !("val" in value)) return null;
  return typeof value.val === "number" && Number.isInteger(value.val) ? value.val : null;
}

export function valueToDisplay(value: Value): string | number {
  if (value === null) return "None";
  if ("val" in value) {
    if (value.val === null) return value.repr ?? "None";
    if (typeof value.val === "number" || typeof value.val === "string") return value.val;
    return JSON.stringify(value.val);
  }
  return `→${value.ref}`;
}
