"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeBinaryTreeView, findPrimaryBinaryTreeRoot } from "@/lib/panels/binaryTreeDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

const RADIUS = 16;

/** d3-hierarchy-style tidy layout (hand-rolled — a plain binary tree's tidy
 * layout is just "x = mean of children's x", so a separate dependency
 * wasn't worth pulling in, see lib/panels/binaryTreeDetection.ts), visit
 * highlighting on the node that changed this step. */
export function BinaryTreePanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoRoot = useMemo(() => (trace ? findPrimaryBinaryTreeRoot(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoRoot;
  const view = useMemo(() => computeBinaryTreeView(trace, step, binding), [trace, step, binding]);

  return (
    <Panel title="Binary Tree" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <svg
          data-testid="binary-tree-svg"
          width={view.width}
          height={view.height + RADIUS * 2}
          className="block"
        >
          <g transform={`translate(${RADIUS}, ${RADIUS})`}>
            {view.nodes.map((node) =>
              node.parentRef ? (
                <line
                  key={`edge-${node.ref}`}
                  x1={view.nodes.find((n) => n.ref === node.parentRef)?.x}
                  y1={view.nodes.find((n) => n.ref === node.parentRef)?.y}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--color-rule)"
                  strokeWidth={1.5}
                />
              ) : null,
            )}
            {view.nodes.map((node) => (
              <g key={node.ref} data-testid={`binary-tree-node-${node.ref}`} data-changed={node.changed}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={RADIUS}
                  fill={node.changed ? "var(--color-mutate)" : "var(--color-panel)"}
                  stroke="var(--color-ink-soft)"
                  strokeWidth={1.5}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="select-none font-mono-label text-[10px]"
                  fill={node.changed ? "#fff" : "var(--color-ink)"}
                >
                  {node.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      ) : (
        <EmptyState title="No binary tree in this trace" description="This fixture has no two-child pointer structure." />
      )}
    </Panel>
  );
}
