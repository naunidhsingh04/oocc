"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeListItemsView, findPrimaryListBinding } from "@/lib/panels/listDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** Push/pop both happen at the same end — rendered as a physical stack
 * growing upward, top = most recently pushed. */
export function StackPanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoBinding = useMemo(() => (trace ? findPrimaryListBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeListItemsView(step, binding), [step, binding]);

  return (
    <Panel title="Stack" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <div className="flex flex-col-reverse items-stretch gap-1" data-testid="stack-items">
          {view.values.map((value, index) => {
            const changed = view.changedIndices.has(index);
            const top = index === view.values.length - 1;
            return (
              <div
                key={index}
                data-testid={`stack-item-${index}`}
                data-changed={changed}
                className="flex h-9 items-center justify-between rounded-control border border-rule px-3 font-mono-label text-[12px] transition-colors"
                style={{
                  backgroundColor: changed ? "var(--color-mutate)" : "var(--color-panel)",
                  color: changed ? "#fff" : "var(--color-ink)",
                }}
              >
                <span>{String(value)}</span>
                {top ? <span className="text-[10px] uppercase text-ink-soft">top</span> : null}
              </div>
            );
          })}
          {view.values.length === 0 ? (
            <div className="py-6 text-center font-mono-label text-[11px] text-ink-soft">empty</div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="No stack in this trace" description="This fixture has no list to visualize as a stack." />
      )}
    </Panel>
  );
}
