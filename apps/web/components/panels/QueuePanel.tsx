"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeListItemsView, findPrimaryListBinding } from "@/lib/panels/listDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** Enqueue at one end, dequeue at the other — rendered left (front, next
 * out) to right (back, most recently enqueued). */
export function QueuePanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoBinding = useMemo(() => (trace ? findPrimaryListBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeListItemsView(step, binding), [step, binding]);

  return (
    <Panel title="Queue" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <div className="flex items-stretch gap-1" data-testid="queue-items">
          {view.values.length === 0 ? (
            <div className="w-full py-6 text-center font-mono-label text-[11px] text-ink-soft">empty</div>
          ) : (
            view.values.map((value, index) => {
              const changed = view.changedIndices.has(index);
              const front = index === 0;
              const back = index === view.values.length - 1;
              return (
                <div key={index} className="flex flex-col items-center gap-1">
                  {front ? <span className="text-[10px] uppercase text-ink-soft">front</span> : <span className="h-3" />}
                  <div
                    data-testid={`queue-item-${index}`}
                    data-changed={changed}
                    className="flex h-9 min-w-12 items-center justify-center rounded-control border border-rule px-3 font-mono-label text-[12px] transition-colors"
                    style={{
                      backgroundColor: changed ? "var(--color-mutate)" : "var(--color-panel)",
                      color: changed ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    {String(value)}
                  </div>
                  {back ? <span className="text-[10px] uppercase text-ink-soft">back</span> : <span className="h-3" />}
                </div>
              );
            })
          )}
        </div>
      ) : binding ? (
        <EmptyState
          title="Queue not created yet"
          description="Step forward — this list isn't in scope until the trace initializes it."
        />
      ) : (
        <EmptyState title="No queue in this trace" description="This fixture has no list to visualize as a queue." />
      )}
    </Panel>
  );
}
