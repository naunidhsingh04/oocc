"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeVariableHistories, computeVariableRows } from "@/lib/panels/variablesDetection";
import { Chip, EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";

const SPARK_WIDTH = 56;
const SPARK_HEIGHT = 18;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * SPARK_WIDTH;
      const y = SPARK_HEIGHT - ((v - min) / range) * SPARK_HEIGHT;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} aria-hidden>
      <polyline points={points} fill="none" stroke="var(--color-ink-soft)" strokeWidth={1} />
    </svg>
  );
}

/** Channel-colored rows, mutate color on the value that just changed, a
 * sparkline per numeric variable — all in-scope locals of the active
 * frame at the current step. */
export function VariablesPanel() {
  const trace = usePlayerStore((state) => state.trace);
  const channels = usePlayerStore((state) => state.channels);
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));
  const prevStep = usePlayerStore((state) => getStateAt(state.trace, state.currentStep - 1));

  const histories = useMemo(() => (trace ? computeVariableHistories(trace) : new Map()), [trace]);
  const rows = useMemo(
    () =>
      computeVariableRows(
        step?.stack[step.stack.length - 1]?.locals,
        prevStep?.stack[prevStep.stack.length - 1]?.locals,
        channels,
        histories,
      ),
    [step, prevStep, channels, histories],
  );

  return (
    <Panel title="Variables" className="min-h-0 flex-1" bodyClassName="overflow-auto p-3">
      {rows.length > 0 ? (
        <div className="flex flex-col gap-1" data-testid="variables-rows">
          {rows.map((row) => (
            <div
              key={row.name}
              data-testid={`variable-row-${row.name}`}
              data-changed={row.changed}
              className="flex items-center justify-between gap-2 rounded-control px-2 py-1 transition-colors"
              style={{
                backgroundColor: row.changed ? "color-mix(in srgb, var(--color-mutate) 15%, transparent)" : "transparent",
              }}
            >
              <Chip channel={row.channel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>{row.name}</Chip>
              <span className="font-mono-label text-[12px] text-ink">{String(row.display)}</span>
              <Sparkline values={row.sparkline} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No variables" description="No locals are in scope at this step." />
      )}
    </Panel>
  );
}
