"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeArrayView, findPrimaryArrayBinding } from "@/lib/panels/arrayDetection";
import { Chip, EmptyState, Panel, Tabs, TabsList, TabsTrigger } from "@oocc/ui";
import { useMemo, useState } from "react";
import type { VizPanelProps } from "./types";

type ArrayViewMode = "bars" | "cells";

/**
 * The first real panel (docs/PRD.md §4.3): bars/cells modes, the mutate
 * color on any element `changed` touched this step, pointer annotations
 * for in-scope index-shaped locals, and a window between the extreme two.
 * Everything here reads from `changed` and frame locals generically —
 * nothing knows what quicksort or bubble sort is (see
 * lib/panels/arrayDetection.ts).
 */
export function ArrayPanel({ panel }: VizPanelProps) {
  const [mode, setMode] = useState<ArrayViewMode>("bars");
  const trace = usePlayerStore((state) => state.trace);
  const channels = usePlayerStore((state) => state.channels);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));

  const autoBinding = useMemo(() => (trace ? findPrimaryArrayBinding(trace) : undefined), [trace]);
  const binding = panel?.binding ?? autoBinding;
  const view = useMemo(() => computeArrayView(step, binding, channels), [step, binding, channels]);

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => setMode(value as ArrayViewMode)}
      className="flex h-full flex-col"
    >
      <Panel
        title="Array"
        className="min-h-0 flex-1"
        actions={
          <TabsList className="gap-2 border-none">
            <TabsTrigger value="bars">Bars</TabsTrigger>
            <TabsTrigger value="cells">Cells</TabsTrigger>
          </TabsList>
        }
        bodyClassName="p-4"
      >
        {view ? (
          <ArrayView view={view} mode={mode} />
        ) : (
          <EmptyState title="No array in this trace" description="This fixture has no primitive list to visualize." />
        )}
      </Panel>
    </Tabs>
  );
}

function ArrayView({
  view,
  mode,
}: {
  view: NonNullable<ReturnType<typeof computeArrayView>>;
  mode: ArrayViewMode;
}) {
  const numericValues = view.values.map((v) => (typeof v === "number" ? v : 0));
  const maxValue = Math.max(1, ...numericValues.map((v) => Math.abs(v)));
  const windowFrom = view.window ? Math.min(view.window.fromIndex, view.window.toIndex) : -1;
  const windowTo = view.window ? Math.max(view.window.fromIndex, view.window.toIndex) : -1;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex flex-1 items-end gap-1" data-testid="array-cells">
        {view.values.map((value, index) => {
          const changed = view.changedIndices.has(index);
          const inWindow = index >= windowFrom && index <= windowTo;
          return (
            <div
              key={index}
              className="relative flex flex-1 flex-col items-center justify-end"
              style={inWindow ? { backgroundColor: "color-mix(in srgb, var(--color-signal) 8%, transparent)" } : undefined}
            >
              {mode === "bars" ? (
                <div
                  data-testid={`array-bar-${index}`}
                  data-changed={changed}
                  className="w-full rounded-t-control transition-colors"
                  style={{
                    height: `${(Math.abs(typeof value === "number" ? value : 1) / maxValue) * 100}%`,
                    minHeight: "4px",
                    backgroundColor: changed ? "var(--color-mutate)" : "var(--color-ink-soft)",
                  }}
                />
              ) : (
                <div
                  data-testid={`array-cell-${index}`}
                  data-changed={changed}
                  className="flex h-9 w-full items-center justify-center border border-rule font-mono-label text-[12px]"
                  style={{ backgroundColor: changed ? "var(--color-mutate)" : "var(--color-panel)", color: changed ? "#fff" : "var(--color-ink)" }}
                >
                  {String(value)}
                </div>
              )}
              <span className="mt-1 font-mono-label text-[10px] text-ink-soft">{index}</span>
              <PointerMarks pointers={view.pointers} index={index} />
            </div>
          );
        })}
      </div>
      {view.pointers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-rule pt-2">
          {view.pointers.map((pointer) => (
            <Chip key={pointer.name} channel={pointer.channel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>
              {pointer.name} = {pointer.index}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PointerMarks({
  pointers,
  index,
}: {
  pointers: { name: string; index: number; channel: number }[];
  index: number;
}) {
  const here = pointers.filter((p) => p.index === index);
  if (here.length === 0) return null;
  return (
    <div className="mt-0.5 flex gap-0.5">
      {here.map((pointer) => (
        <span
          key={pointer.name}
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: `var(--color-ch-${pointer.channel})` }}
          title={pointer.name}
        />
      ))}
    </div>
  );
}
