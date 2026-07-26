"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeLinkedListView, findPrimaryLinkedListRoot } from "@/lib/panels/linkedListDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";
import type { VizPanelProps } from "./types";

/** Node boxes + next arrows; correct (non-hanging) rendering when the
 * chain is actually a cycle, per docs/PRD.md §4.3. */
export function LinkedListPanel({ panel }: VizPanelProps) {
  const trace = usePlayerStore((state) => state.trace);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoRoot = useMemo(() => (trace ? findPrimaryLinkedListRoot(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoRoot;
  const view = useMemo(() => computeLinkedListView(trace, step, binding), [trace, step, binding]);

  return (
    <Panel title="Linked List" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {view ? (
        <div className="flex flex-wrap items-center gap-1" data-testid="linked-list-chain">
          {view.nodes.map((node, i) => (
            <div key={node.ref} className="flex items-center gap-1">
              <div
                data-testid={`linked-list-node-${node.ref}`}
                data-changed={node.changed}
                className="flex h-10 min-w-12 items-center justify-center rounded-control border border-rule px-2 font-mono-label text-[12px] transition-colors"
                style={{
                  backgroundColor: node.changed ? "var(--color-mutate)" : "var(--color-panel)",
                  color: node.changed ? "#fff" : "var(--color-ink)",
                }}
                title={node.ref}
              >
                {node.label}
              </div>
              {node.nextRef ? (
                <span aria-hidden className="text-ink-soft">
                  →
                </span>
              ) : i === view.nodes.length - 1 && view.hasCycle ? (
                <span aria-hidden className="font-mono-label text-[11px] text-warn">
                  ↻ cycle
                </span>
              ) : (
                <span aria-hidden className="font-mono-label text-[11px] text-ink-soft">
                  ∅
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No linked structure in this trace" description="This fixture has no pointer-chained instances." />
      )}
    </Panel>
  );
}
