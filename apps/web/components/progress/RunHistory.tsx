"use client";

import { buildChannelAssignment, computeStepTicks, type TickInfo } from "@/lib/player";
import { fetchFixture } from "@/lib/fixtures";
import { buildDemoRunEntries, type DemoRunEntry } from "@/lib/progress/demoData";
import { downsampleTicks, getRunHistory, type RunHistoryEntry } from "@/lib/progress/runHistory";
import { Chip, EmptyState, Panel } from "@oocc/ui";
import { useEffect, useState } from "react";
import { MiniRibbon } from "@/components/curriculum/MiniRibbon";

interface RunRow {
  id: string;
  name: string;
  timestamp: string;
  status: string;
  language: string;
  stepCount: number;
  ticks: TickInfo[];
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function realEntryToRow(entry: RunHistoryEntry): RunRow {
  return {
    id: entry.id,
    name: entry.name,
    timestamp: entry.timestamp,
    status: entry.status,
    language: entry.language,
    stepCount: entry.stepCount,
    ticks: entry.ticks,
  };
}

/**
 * Brief item 3: run history with ribbon thumbnails. Option (b) from the
 * phase brief — real runs made in this browser session
 * (`lib/progress/runHistory.ts`, populated by `useRunHistoryTracker`
 * watching the global player store) take priority over demo data, falling
 * back to a handful of committed fixtures (still real traces, never
 * fabricated) only when there's no real history yet. Each thumbnail reuses
 * `MiniRibbon` directly per CLAUDE.md's own precedent, wrapped in a
 * `pointer-events-none`/`aria-hidden` shell: these are decorative previews
 * (the row's own text already carries every fact a learner needs — name,
 * status, step count, when), not a second scrubbable control surface, so
 * they're deliberately not part of the tab order.
 */
export function RunHistory() {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const real = getRunHistory();
      if (real.length > 0) {
        if (!cancelled) {
          setRows(real.map(realEntryToRow));
          setIsDemo(false);
        }
        return;
      }

      const demoEntries = buildDemoRunEntries();
      const demoRows = await Promise.all(demoEntries.map(loadDemoRow));
      if (!cancelled) {
        setRows(demoRows.filter((r): r is RunRow => r !== null));
        setIsDemo(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel
      title="Run history"
      actions={isDemo ? <Chip tone="warn">Demo data</Chip> : undefined}
      bodyClassName="min-h-[12rem]"
    >
      {rows === null ? (
        <div className="p-3 font-mono-label text-[11px] text-ink-soft">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No runs yet" description="Run a program to start building real history here." />
      ) : (
        <ul className="divide-y divide-rule">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-3 py-2">
              <div className="w-32 shrink-0">
                <div className="truncate font-mono-label text-[11px] uppercase tracking-[0.04em] text-ink">
                  {row.name}
                </div>
                <div className="font-mono-label text-[10px] text-ink-soft">{formatTimestamp(row.timestamp)}</div>
              </div>
              <div className="min-w-0 flex-1 pointer-events-none" aria-hidden>
                <MiniRibbon ticks={row.ticks} currentStep={row.ticks.length - 1} onScrub={() => {}} />
              </div>
              <div className="w-24 shrink-0 text-right font-mono-label text-[10px] text-ink-soft">
                {row.stepCount.toLocaleString()} steps
              </div>
              <div className="w-20 shrink-0 text-right">
                <span
                  className={
                    row.status === "ok"
                      ? "font-mono-label text-[10px] uppercase text-ok"
                      : "font-mono-label text-[10px] uppercase text-warn"
                  }
                >
                  {row.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function loadDemoRow(entry: DemoRunEntry): Promise<RunRow | null> {
  try {
    const bundle = await fetchFixture(entry.fixture);
    const channels = buildChannelAssignment(bundle.trace);
    const ticks = downsampleTicks(computeStepTicks(bundle.trace, channels));
    return {
      id: entry.id,
      name: entry.label,
      timestamp: entry.timestamp,
      status: bundle.trace.status,
      language: bundle.trace.language,
      stepCount: bundle.trace.steps.length,
      ticks,
    };
  } catch {
    return null;
  }
}
