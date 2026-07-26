/* eslint-disable */
/**
 * AUTO-GENERATED — do not hand-edit.
 * Source: packages/contracts/viz-plan.schema.json
 * Regenerate with `pnpm gen:contracts` from the repo root.
 */

/**
 * Panel registry v1 (§4.3).
 */
export type PanelType =
  | "array"
  | "array_2d"
  | "linked_list"
  | "binary_tree"
  | "graph"
  | "stack"
  | "queue"
  | "hash_map"
  | "call_stack"
  | "recursion_tree"
  | "variables"
  | "heap_objects"
  | "console"
  | "timeline";
/**
 * What the panel is bound to: a heap ref ("o1"), a frame path ("frame.lo"), or another addressable trace location.
 */
export type Binding = string;
/**
 * Placement hint within `layout`, e.g. "primary" or "secondary".
 */
export type PanelRole = string;
/**
 * A panel decoration. "pointer" and "window" are the known kinds from §4.3's worked example; any other kind validates structurally as {kind, label?} plus free-form fields so the registry can grow without breaking older plans.
 */
export type Annotation = PointerAnnotation | WindowAnnotation | GenericAnnotation;

/**
 * Panel plan emitted by the viz_planner agent node (PRD docs/PRD.md §4.3). Panel `type` must be a member of the hardcoded panel registry v1; hallucinated types must be validated against this schema and dropped before rendering. Append-only: see trace.schema.json header for the versioning policy.
 */
export interface VizPlan {
  /**
   * Named workspace layout, e.g. "primary+stack".
   */
  layout: string;
  panels: Panel[];
}
export interface Panel {
  id: string;
  type: PanelType;
  binding?: Binding;
  role?: PanelRole;
  annotations?: Annotation[];
}
export interface PointerAnnotation {
  kind: "pointer";
  label: string;
  bind: Binding;
}
export interface WindowAnnotation {
  kind: "window";
  from: Binding;
  to: Binding;
}
/**
 * Forward-compatible fallback for annotation kinds not yet in the registry.
 */
export interface GenericAnnotation {
  kind: string;
  label?: string;
  [k: string]: unknown;
}
