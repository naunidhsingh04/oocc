"use client";

import { usePlayerStore } from "@/lib/player";
import { computeGraphLayout, computeGraphView, findPrimaryGraphBinding } from "@/lib/panels/graphDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** d3-force settled once then frozen — the layout must never drift during
 * playback (docs/PRD.md §4.3). Only visit/traversal highlighting changes
 * per step; node/edge positions are memoized on (trace, binding) alone. */
export function GraphPanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const currentStep = usePlayerStore((state) => state.currentStep);

  const autoBinding = useMemo(() => (trace ? findPrimaryGraphBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;

  const layout = useMemo(
    () => (trace && binding ? computeGraphLayout(trace, binding) : null),
    [trace, binding],
  );
  const view = useMemo(
    () => (trace && layout ? computeGraphView(trace, currentStep, layout) : null),
    [trace, layout, currentStep],
  );

  return (
    <Panel title="Graph" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <svg data-testid="graph-svg" width={view.width} height={view.height} className="block">
          {view.edges.map((edge) => {
            const source = view.nodes.find((n) => n.id === edge.source)!;
            const target = view.nodes.find((n) => n.id === edge.target)!;
            const key = [edge.source, edge.target].sort().join("~");
            const traversed = view.changedEdgeKeys.has(key);
            return (
              <line
                key={key}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={traversed ? "var(--color-signal)" : "var(--color-rule)"}
                strokeWidth={traversed ? 2 : 1}
              />
            );
          })}
          {view.nodes.map((node) => {
            const visited = view.visitedNodeIds.has(node.id);
            return (
              <g key={node.id} data-testid={`graph-node-${node.id}`} data-visited={visited}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={14}
                  fill={visited ? "var(--color-signal)" : "var(--color-panel)"}
                  stroke="var(--color-ink-soft)"
                  strokeWidth={1.5}
                />
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="select-none font-mono-label text-[10px]"
                  fill={visited ? "#fff" : "var(--color-ink)"}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <EmptyState title="No graph in this trace" description="This fixture has no adjacency-shaped heap object." />
      )}
    </Panel>
  );
}
