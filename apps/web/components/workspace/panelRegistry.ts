import type { PanelType } from "@oocc/contracts";
import type { ReactElement } from "react";
import { Array2DPanel } from "../panels/Array2DPanel";
import { ArrayPanel } from "../panels/ArrayPanel";
import { BinaryTreePanel } from "../panels/BinaryTreePanel";
import { CallStackPanel } from "../panels/CallStackPanel";
import { ConsolePanel } from "../panels/ConsolePanel";
import { GenericPanel } from "../panels/GenericPanel";
import { GraphPanel } from "../panels/GraphPanel";
import { HashMapPanel } from "../panels/HashMapPanel";
import { HeapObjectsPanel } from "../panels/HeapObjectsPanel";
import { LinkedListPanel } from "../panels/LinkedListPanel";
import { QueuePanel } from "../panels/QueuePanel";
import { RecursionTreePanel } from "../panels/RecursionTreePanel";
import { StackPanel } from "../panels/StackPanel";
import { TimelinePanel } from "../panels/TimelinePanel";
import type { VizPanelProps } from "../panels/types";
import { VariablesPanel } from "../panels/VariablesPanel";

/**
 * The panel registry (docs/PRD.md §4.3, packages/contracts/viz-plan.schema.json):
 * every `PanelType` viz_planner can emit maps to exactly one component here.
 * Anything outside this map (a hallucinated or future type) renders as
 * `GenericPanel`'s grey opaque chip instead of crashing the layout engine —
 * the same "degrade, never break" rule the trace contract itself uses for
 * unknown heap object types (PRD §3.2).
 */
export const PANEL_REGISTRY: Record<PanelType, (props: VizPanelProps) => ReactElement> = {
  array: ArrayPanel,
  array_2d: Array2DPanel,
  linked_list: LinkedListPanel,
  binary_tree: BinaryTreePanel,
  graph: GraphPanel,
  stack: StackPanel,
  queue: QueuePanel,
  hash_map: HashMapPanel,
  call_stack: CallStackPanel,
  recursion_tree: RecursionTreePanel,
  variables: VariablesPanel,
  heap_objects: HeapObjectsPanel,
  console: ConsolePanel,
  timeline: TimelinePanel,
};

export const PANEL_TYPES = Object.keys(PANEL_REGISTRY) as PanelType[];

export const PANEL_LABELS: Record<PanelType, string> = {
  array: "Array",
  array_2d: "Grid",
  linked_list: "Linked List",
  binary_tree: "Binary Tree",
  graph: "Graph",
  stack: "Stack",
  queue: "Queue",
  hash_map: "Hash Map",
  call_stack: "Call Stack",
  recursion_tree: "Recursion Tree",
  variables: "Variables",
  heap_objects: "Heap Objects",
  console: "Console",
  timeline: "Timeline",
};

export function resolvePanelComponent(type: string): (props: VizPanelProps) => ReactElement {
  return (PANEL_REGISTRY as Record<string, (props: VizPanelProps) => ReactElement>)[type] ?? GenericPanel;
}
