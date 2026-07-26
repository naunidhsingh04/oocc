"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeHashMapView, findPrimaryHashMapBinding } from "@/lib/panels/hashMapDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** Buckets, collisions visible, the accessed key highlighted. */
export function HashMapPanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoBinding = useMemo(() => (trace ? findPrimaryHashMapBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeHashMapView(step, binding), [step, binding]);

  return (
    <Panel title="Hash Map" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <div className="flex flex-col gap-1" data-testid="hash-map-buckets">
          {view.buckets.map((entries, bucket) => (
            <div key={bucket} className="flex items-center gap-2">
              <span className="w-6 shrink-0 font-mono-label text-[10px] text-ink-soft">{bucket}</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {entries.map((entry) => (
                  <div
                    key={entry.key}
                    data-testid={`hash-map-entry-${entry.key}`}
                    data-changed={entry.changed}
                    className="rounded-control border border-rule px-2 py-1 font-mono-label text-[11px] transition-colors"
                    style={{
                      backgroundColor: entry.changed ? "var(--color-mutate)" : "var(--color-panel)",
                      color: entry.changed ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    {entry.key}: {String(entry.value)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No hash map in this trace" description="This fixture has no dict to visualize." />
      )}
    </Panel>
  );
}
