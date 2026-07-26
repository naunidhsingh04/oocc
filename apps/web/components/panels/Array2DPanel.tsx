"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeArray2DView, findPrimaryArray2DBinding } from "@/lib/panels/array2dDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** A value heatmap grid for DP tables and similar. Zero algorithm-specific
 * logic — any list-of-lists heap object renders, regardless of what it's
 * called or what wrote it. */
export function Array2DPanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoBinding = useMemo(() => (trace ? findPrimaryArray2DBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeArray2DView(step, binding), [step, binding]);

  return (
    <Panel title="Grid" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <div className="inline-flex flex-col gap-0.5" data-testid="array-2d-grid">
          {view.rows.map((row, r) => (
            <div key={r} className="flex gap-0.5">
              {row.map((value, c) => {
                const changed = view.changedCells.has(`${r},${c}`);
                const intensity =
                  typeof value === "number" ? Math.min(1, Math.abs(value) / view.maxValue) : 0;
                return (
                  <div
                    key={c}
                    data-testid={`array-2d-cell-${r}-${c}`}
                    data-changed={changed}
                    className="flex h-8 w-10 shrink-0 items-center justify-center border border-rule font-mono-label text-[11px] transition-colors"
                    style={{
                      backgroundColor: changed
                        ? "var(--color-mutate)"
                        : `color-mix(in srgb, var(--color-signal) ${Math.round(intensity * 35)}%, var(--color-panel))`,
                      color: changed ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    {String(value)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No 2D grid in this trace" description="This fixture has no list-of-lists to visualize." />
      )}
    </Panel>
  );
}
