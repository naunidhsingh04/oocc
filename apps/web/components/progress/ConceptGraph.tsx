import { computeConceptGraphLayout } from "@/lib/progress/conceptGraphLayout";
import { masteryFillRatio, masteryPercentLabel } from "@/lib/progress/mastery";
import { conceptChannelColor } from "@/lib/progress/concepts";
import type { ConceptProgressView } from "@/lib/progress/types";
import { Panel } from "@oocc/ui";

const NODE_RADIUS = 20;

export interface ConceptGraphProps {
  views: readonly ConceptProgressView[];
}

/**
 * Brief item 1: mastery encoded as fill strength, not a color legend. Each
 * node is a hairline-stroked circle (stroke color = the concept's stable
 * channel color, `lib/player/channels.ts`'s per-identifier mechanism, used
 * here for *identity* only) with an inner fill that rises from the bottom
 * to `masteryFillRatio` of the node's height — a level gauge, not a
 * five-color badge. Layout is the fixed prereq-DAG columns from
 * `conceptGraphLayout.ts`; edges are plain hairlines, exactly like every
 * other graph in this app (`GraphPanel.tsx`) draws its adjacency edges.
 */
export function ConceptGraph({ views }: ConceptGraphProps) {
  const layout = computeConceptGraphLayout();
  const byId = new Map(views.map((v) => [v.conceptId, v]));

  return (
    <Panel title="Concept graph" bodyClassName="overflow-auto p-3">
      <svg
        role="img"
        aria-label="Concept prerequisite graph, node fill shows mastery"
        width={layout.width}
        height={layout.height + 24}
        className="block"
      >
        {layout.edges.map((edge) => {
          const from = layout.nodes.find((n) => n.id === edge.from);
          const to = layout.nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}~${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--color-rule)"
              strokeWidth={1}
            />
          );
        })}
        {layout.nodes.map((node) => {
          const view = byId.get(node.id);
          const mastery = view?.mastery ?? 0;
          const fillRatio = masteryFillRatio(mastery);
          const clipId = `progress-fill-${node.id}`;
          const fillHeight = fillRatio * NODE_RADIUS * 2;
          const color = conceptChannelColor(node.id);

          return (
            <g key={node.id}>
              <clipPath id={clipId}>
                <circle cx={node.x} cy={node.y} r={NODE_RADIUS} />
              </clipPath>
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                fill="var(--color-panel)"
                stroke={color}
                strokeWidth={1.5}
              />
              <rect
                x={node.x - NODE_RADIUS}
                y={node.y + NODE_RADIUS - fillHeight}
                width={NODE_RADIUS * 2}
                height={fillHeight}
                fill={color}
                fillOpacity={0.45}
                clipPath={`url(#${clipId})`}
              />
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none font-mono-label text-[10px]"
                fill="var(--color-ink)"
              >
                {masteryPercentLabel(mastery)}
              </text>
              <text
                x={node.x}
                y={node.y + NODE_RADIUS + 14}
                textAnchor="middle"
                className="select-none font-mono-label text-[9px] uppercase tracking-[0.04em]"
                fill="var(--color-ink-soft)"
              >
                {view?.title ?? node.id}
              </text>
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
