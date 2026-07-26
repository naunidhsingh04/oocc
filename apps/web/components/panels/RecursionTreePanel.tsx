"use client";

import { usePlayerStore } from "@/lib/player";
import { computeRecursionTree } from "@/lib/panels/recursionTreeDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";

const RADIUS = 14;

/** The call graph unfolded over time; memoized/recomputed calls (repeated
 * (func, args) signatures — a memoization opportunity, structurally
 * identical to insight_scanner's redundant_recomputation detector)
 * rendered visually distinct from fresh calls. */
export function RecursionTreePanel() {
  const trace = usePlayerStore((state) => state.trace);
  const currentStep = usePlayerStore((state) => state.currentStep);

  const view = useMemo(() => (trace ? computeRecursionTree(trace) : null), [trace]);

  return (
    <Panel title="Recursion Tree" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <svg data-testid="recursion-tree-svg" width={view.width} height={view.height + RADIUS * 2} className="block">
          <g transform={`translate(${RADIUS}, ${RADIUS})`}>
            {view.nodes.map((node) => {
              const parent = view.nodes.find((n) => n.frameId === node.parentFrameId);
              return parent ? (
                <line
                  key={`edge-${node.frameId}`}
                  x1={parent.x}
                  y1={parent.y}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--color-rule)"
                  strokeWidth={1.5}
                />
              ) : null;
            })}
            {view.nodes.map((node) => {
              const active = node.firstCallStep <= currentStep;
              return (
                <g
                  key={node.frameId}
                  data-testid={`recursion-tree-node-${node.frameId}`}
                  data-recomputation={node.recomputation}
                  opacity={active ? 1 : 0.25}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={RADIUS}
                    fill={node.recomputation ? "var(--color-warn)" : "var(--color-panel)"}
                    stroke="var(--color-ink-soft)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="select-none font-mono-label text-[9px]"
                    fill={node.recomputation ? "#fff" : "var(--color-ink)"}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      ) : (
        <EmptyState title="No recursion in this trace" description="This fixture never calls a function from within itself." />
      )}
    </Panel>
  );
}
