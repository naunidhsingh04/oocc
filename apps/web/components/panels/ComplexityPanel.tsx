"use client";

import { usePlayerStore } from "@/lib/player";
import {
  bestFitRSquared,
  complexityContradiction,
  fittedCurvePoints,
  modelLabel,
  scatterPoints,
} from "@/lib/panels/complexityView";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = 28;

const SHAPE_MARKERS: Record<string, string> = {
  random: "var(--color-ch-1)",
  sorted: "var(--color-ch-2)",
  reverse: "var(--color-ch-3)",
  all_equal: "var(--color-ch-4)",
};

/**
 * The empirically measured curve from the user's own code (docs/PRD.md
 * §4.3) — a scatter of every (n, step_count) sample the executor actually
 * ran, the winning model's fitted line, and its R², labelled in IBM Plex
 * Mono. This is not part of the panel registry (it has no PanelType — the
 * backend's complexity_analyst output has no heap binding to mount from),
 * so it's a fixed panel shown whenever `analysis.complexity` exists,
 * alongside the plan-driven grid rather than inside it.
 */
export function ComplexityPanel() {
  const analysis = usePlayerStore((state) => state.analysis);
  const report = analysis?.complexity ?? null;

  const points = useMemo(() => (report ? scatterPoints(report) : []), [report]);
  const curve = useMemo(() => (report ? fittedCurvePoints(report) : []), [report]);
  const rSquared = report ? bestFitRSquared(report) : 0;
  const contradiction = report ? complexityContradiction(report) : null;

  if (!report || points.length === 0) {
    return (
      <Panel title="Complexity" className="min-h-0 flex-1" bodyClassName="p-4">
        <EmptyState
          title="No complexity measured"
          description="The primary function's size parameter couldn't be confidently identified."
        />
      </Panel>
    );
  }

  const maxN = Math.max(...points.map((p) => p.n));
  const maxStepCount = Math.max(...points.map((p) => p.stepCount), ...curve.map((c) => c.value));
  const xScale = (n: number) => PADDING + (n / maxN) * (WIDTH - PADDING * 2);
  const yScale = (v: number) => HEIGHT - PADDING - (v / maxStepCount) * (HEIGHT - PADDING * 2);

  const curvePath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.n)},${yScale(p.value)}`).join(" ");

  return (
    <Panel title="Complexity" className="min-h-0 flex-1" bodyClassName="p-4">
      <div className="flex h-full flex-col gap-2">
        <svg data-testid="complexity-scatter" width={WIDTH} height={HEIGHT} className="block">
          <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} stroke="var(--color-rule)" />
          <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} stroke="var(--color-rule)" />
          <path d={curvePath} fill="none" stroke="var(--color-signal)" strokeWidth={1.5} />
          {points.map((p, i) => (
            <circle
              key={i}
              data-testid={`complexity-point-${p.shape}-${p.n}`}
              cx={xScale(p.n)}
              cy={yScale(p.stepCount)}
              r={3.5}
              fill={SHAPE_MARKERS[p.shape] ?? "var(--color-ink-soft)"}
            />
          ))}
        </svg>
        <div className="font-mono-label text-[12px] text-ink">
          Best fit: <span className="font-medium">{modelLabel(report.best_fit)}</span> (R²={" "}
          {rSquared.toFixed(4)})
        </div>
        {contradiction ? (
          <div
            data-testid="complexity-contradiction"
            className="rounded-control border border-rule px-2 py-1.5 font-mono-label text-[11px] text-ink-soft"
          >
            {contradiction}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
