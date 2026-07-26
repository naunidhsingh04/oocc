/* eslint-disable */
/**
 * AUTO-GENERATED — do not hand-edit.
 * Source: packages/contracts/trace.schema.json
 * Regenerate with `pnpm gen:contracts` from the repo root.
 */

/**
 * OOCC execution trace envelope. PRD docs/PRD.md §3.1-3.3. This file is append-only: existing fields, enum members, and $defs must not be removed or repurposed after release. Add new optional fields or new enum members only, and bump schema_version's minor component in the same PR.
 */
export type Trace = {
  [k: string]: unknown;
} & {
  /**
   * Contract version, e.g. "1.0". Bump the minor component for additive changes.
   */
  schema_version: string;
  /**
   * Opaque run identifier.
   */
  run_id: string;
  /**
   * Source language the trace was produced from. §3.5 requires C++ to reuse this same contract.
   */
  language: "python" | "cpp";
  /**
   * sha256 of the exact source text that was executed. Used as the cache key (§4.4) and for wasm artifact caching (§3.5).
   */
  source_hash: string;
  status: Status;
  meta: Meta;
  error?: ExecutionError;
  /**
   * The full step-by-step trace. May be a truncated prefix/suffix per §3.3 when meta.truncated is true.
   */
  steps: Step[];
};
export type Status = "ok" | "runtime_error" | "timeout" | "step_limit" | "memory_limit" | "compile_error";
export type Step = {
  [k: string]: unknown;
} & {
  /**
   * 0-based, monotonic step index.
   */
  i: number;
  event: StepEvent;
  /**
   * 1-based line in source.
   */
  line: number;
  /**
   * Name of the function owning this step (top of stack).
   */
  func: string;
  /**
   * Call stack depth.
   */
  depth: number;
  /**
   * @minItems 1
   */
  stack: [Frame, ...Frame[]];
  /**
   * Full snapshot of reachable non-primitives at this step, keyed by heap id.
   */
  heap: {
    [k: string]: HeapObject;
  };
  stdout_delta: string;
  /**
   * Paths mutated since the previous step. Drives every highlight animation — must be exact.
   */
  changed: ChangedPath[];
  returned?: Value;
  /**
   * True when this step exceeded the 5,000 heap-objects-per-step cap (§3.3) and deep-snapshotting was stopped.
   */
  heap_truncated?: boolean;
};
export type StepEvent = "line" | "call" | "return" | "exception" | "stdout";
export type FrameId = string;
/**
 * The {val:...}/{ref:"oN"} encoding (§3.2). Primitives inline as {val}; anything else is a heap reference. Bare JSON null is accepted as shorthand wherever a Value is expected (e.g. a None-valued object field) and is equivalent to {"val": null, "repr": "None"} — reconciles the worked TreeNode example in §3.2, where `"right": null` appears unwrapped, with the value-encoding paragraph's stated rule that null is {"val": null}.
 */
export type Value = null | ValueInline | ValueRef;
export type HeapRef = string;
/**
 * A heap-resident value. §3.2 lists list, tuple, dict, set, str (>40 chars), object/instance (fields), function, and the opaque fallback. An object/instance uses its class name as the `type` discriminator (see the worked TreeNode example in §3.2), so `type` is unconstrained beyond excluding the reserved primitive discriminators handled by the other branches.
 */
export type HeapObject = HeapList | HeapTuple | HeapDict | HeapSet | HeapStr | HeapFunction | HeapOpaque | HeapInstance;
/**
 * The `changed` path grammar (§3.2): frame_id.local | oN[index] | oN.field | oN{key}.
 */
export type ChangedPath = string;
export type Identifier = string;

export interface Meta {
  duration_ms: number;
  /**
   * Number of steps actually recorded in `steps` (may be less than the executed step count when truncated).
   */
  step_count: number;
  /**
   * True when `steps` does not contain every executed step. §3.3: on step_limit breach, keep first 40k + last 10k.
   */
  truncated: boolean;
  stdin: string;
  peak_heap_objects: number;
}
/**
 * Populated when status is runtime_error or compile_error.
 */
export interface ExecutionError {
  /**
   * Exception class name, e.g. "ZeroDivisionError".
   */
  type: string;
  message: string;
  line?: number;
  /**
   * Index into `steps` (or the pre-truncation step count) where the error occurred.
   */
  step?: number;
  traceback?: string[];
}
/**
 * One entry in Step.stack. Index 0 of the enclosing array is the outermost frame.
 */
export interface Frame {
  frame_id: FrameId;
  func: string;
  line: number;
  /**
   * Local variable bindings for this frame at this step.
   */
  locals: {
    [k: string]: Value;
  };
  /**
   * Parameter names in call order, present on frames pushed by a call.
   */
  args?: string[];
  /**
   * Line in the caller's frame that made this call.
   */
  call_site_line?: number;
}
/**
 * A primitive inlined directly in the trace, e.g. {"val": 4}.
 */
export interface ValueInline {
  val: unknown;
  /**
   * Optional display form, e.g. "None" for a Python None val.
   */
  repr?: string;
}
/**
 * A reference into `heap`, e.g. {"ref": "o1"}.
 */
export interface ValueRef {
  ref: HeapRef;
}
export interface HeapList {
  type: "list";
  len: number;
  items: Value[];
}
export interface HeapTuple {
  type: "tuple";
  len: number;
  items: Value[];
}
export interface HeapDict {
  type: "dict";
  len: number;
  /**
   * Insertion-ordered key/value pairs. A list (not a JSON object) because Python dict keys need not be strings.
   */
  entries: {
    key: Value;
    value: Value;
  }[];
}
export interface HeapSet {
  type: "set";
  len: number;
  items: Value[];
}
/**
 * Strings longer than 40 chars move to the heap; shorter strings stay inlined as {val: "..."}.
 */
export interface HeapStr {
  type: "str";
  len: number;
  value: string;
}
export interface HeapFunction {
  type: "function";
  name: string;
  qualname?: string;
}
/**
 * Fallback for any value the tracer can't project into a richer type.
 */
export interface HeapOpaque {
  type: "opaque";
  repr: string;
}
/**
 * object (with fields) / instance of a user class. `type` is the class name, e.g. "TreeNode".
 */
export interface HeapInstance {
  type: string;
  fields: {
    [k: string]: Value;
  };
}
