"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeHeapObjectsLayout, computeHeapObjectsView } from "@/lib/panels/heapObjectsDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";

const BOX_WIDTH = 92;
const BOX_HEIGHT = 24;

/** Objects with drawn reference arrows between them — the panel that
 * teaches aliasing. Box positions are frozen per-trace (like the graph
 * panel); only which arrows are drawn and which objects just changed
 * updates per step. */
export function HeapObjectsPanel() {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const layout = useMemo(() => (trace ? computeHeapObjectsLayout(trace) : null), [trace]);
  const view = useMemo(() => (layout ? computeHeapObjectsView(step, layout) : null), [step, layout]);

  return (
    <Panel title="Heap Objects" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <svg data-testid="heap-objects-svg" width={view.width} height={view.height} className="block">
          <defs>
            <marker id="heap-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-signal)" />
            </marker>
          </defs>
          {view.arrows.map((arrow, i) => {
            const from = view.boxes.find((b) => b.ref === arrow.fromRef)!;
            const to = view.boxes.find((b) => b.ref === arrow.toRef)!;
            return (
              <line
                key={`${arrow.fromRef}-${arrow.fromField}-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--color-signal)"
                strokeWidth={1.25}
                markerEnd="url(#heap-arrow)"
              />
            );
          })}
          {view.boxes.map((box) => {
            const changed = view.changedRefs.has(box.ref);
            return (
              <g
                key={box.ref}
                data-testid={`heap-object-${box.ref}`}
                data-changed={changed}
                transform={`translate(${box.x - BOX_WIDTH / 2}, ${box.y - BOX_HEIGHT / 2})`}
              >
                <rect
                  width={BOX_WIDTH}
                  height={BOX_HEIGHT}
                  rx={2}
                  fill={changed ? "var(--color-mutate)" : "var(--color-panel)"}
                  stroke="var(--color-ink-soft)"
                  strokeWidth={1}
                />
                <text
                  x={BOX_WIDTH / 2}
                  y={BOX_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="select-none font-mono-label text-[9px]"
                  fill={changed ? "#fff" : "var(--color-ink)"}
                >
                  {box.ref}: {box.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <EmptyState title="No heap objects" description="This fixture has no reference-holding heap objects." />
      )}
    </Panel>
  );
}
