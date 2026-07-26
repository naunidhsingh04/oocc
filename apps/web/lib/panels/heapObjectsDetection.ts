import type { HeapObject, Step, Trace } from "@oocc/contracts";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { valueToDisplay } from "./heapValue";

export interface HeapObjectBox {
  ref: string;
  label: string;
  fields: Array<{ name: string; display: string | number; targetRef: string | null }>;
  x: number;
  y: number;
}

export interface HeapObjectsLayout {
  boxes: HeapObjectBox[];
  width: number;
  height: number;
}

export interface HeapObjectArrow {
  fromRef: string;
  fromField: string;
  toRef: string;
}

export interface HeapObjectsView extends HeapObjectsLayout {
  arrows: HeapObjectArrow[];
  changedRefs: ReadonlySet<string>;
}

const WIDTH = 420;
const HEIGHT = 300;
const MAX_OBJECTS = 60; // a dense heap_objects panel stops teaching aliasing and starts being noise

function fieldsOf(obj: HeapObject): Array<[string, unknown]> {
  if ("fields" in obj) return Object.entries(obj.fields);
  if ("entries" in obj) return obj.entries.map((e) => [String(valueToDisplay(e.key)), e.value] as [string, unknown]);
  if ("items" in obj) return obj.items.map((v, i) => [String(i), v] as [string, unknown]);
  return [];
}

function labelOf(ref: string, obj: HeapObject): string {
  if ("fields" in obj) return obj.type;
  return `${obj.type}(${ref})`;
}

/** Every heap object reachable at the trace's richest moment (the step
 * with the most heap entries — objects are only ever added, so this is a
 * superset), frozen into a single layout so aliasing is legible instead of
 * jumping around every step. Memoize on `trace` alone. */
export function computeHeapObjectsLayout(trace: Trace): HeapObjectsLayout | null {
  let richestStep: Step | undefined;
  for (const candidate of trace.steps) {
    if (!richestStep || Object.keys(candidate.heap).length > Object.keys(richestStep.heap).length) {
      richestStep = candidate;
    }
  }
  if (!richestStep) return null;

  const refs = Object.keys(richestStep.heap).slice(0, MAX_OBJECTS);
  if (refs.length === 0) return null;

  const links: { source: string; target: string }[] = [];
  for (const ref of refs) {
    const obj = richestStep.heap[ref]!;
    for (const [, value] of fieldsOf(obj)) {
      const targetRef =
        value !== null && typeof value === "object" && "ref" in (value as object)
          ? (value as { ref: string }).ref
          : undefined;
      if (targetRef && refs.includes(targetRef)) links.push({ source: ref, target: targetRef });
    }
  }

  interface SimNode {
    id: string;
    x?: number;
    y?: number;
  }
  const simNodes: SimNode[] = refs.map((id) => ({ id }));
  const simulation = forceSimulation(simNodes)
    .force("link", forceLink(links).id((d: unknown) => (d as SimNode).id).distance(90))
    .force("charge", forceManyBody().strength(-200))
    .force("collide", forceCollide(48))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .stop();
  const tickCount = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  for (let i = 0; i < tickCount; i += 1) simulation.tick();

  const boxes: HeapObjectBox[] = refs.map((ref) => {
    const obj = richestStep.heap[ref]!;
    const node = simNodes.find((n) => n.id === ref)!;
    const fields = fieldsOf(obj)
      .slice(0, 4)
      .map(([name, value]) => {
        const targetRef =
          value !== null && typeof value === "object" && "ref" in (value as object)
            ? (value as { ref: string }).ref
            : null;
        return {
          name,
          display: targetRef ? `→${targetRef}` : valueToDisplay(value as never),
          targetRef,
        };
      });
    return {
      ref,
      label: labelOf(ref, obj),
      fields,
      x: Math.max(60, Math.min(WIDTH - 60, node.x ?? WIDTH / 2)),
      y: Math.max(30, Math.min(HEIGHT - 30, node.y ?? HEIGHT / 2)),
    };
  });

  return { boxes, width: WIDTH, height: HEIGHT };
}

export function computeHeapObjectsView(step: Step | undefined, layout: HeapObjectsLayout): HeapObjectsView {
  const arrows: HeapObjectArrow[] = [];
  const changedRefs = new Set<string>();

  if (step) {
    for (const box of layout.boxes) {
      const obj = step.heap[box.ref];
      if (!obj) continue;
      for (const [field, value] of fieldsOf(obj)) {
        const targetRef =
          value !== null && typeof value === "object" && "ref" in (value as object)
            ? (value as { ref: string }).ref
            : undefined;
        if (targetRef && layout.boxes.some((b) => b.ref === targetRef)) {
          arrows.push({ fromRef: box.ref, fromField: field, toRef: targetRef });
        }
      }
    }
    for (const path of step.changed) {
      const ref = path.split("[", 1)[0]!.split(".", 1)[0]!.split("{", 1)[0]!;
      changedRefs.add(ref);
    }
  }

  return { ...layout, arrows, changedRefs };
}
