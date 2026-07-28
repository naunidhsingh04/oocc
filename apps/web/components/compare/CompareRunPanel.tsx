"use client";

import { Chip, Panel } from "@oocc/ui";
import { useMemo } from "react";
import { CodeEditorView } from "@/components/editor/CodeEditorView";
import { MiniRibbon } from "@/components/curriculum/MiniRibbon";
import type { FixtureName } from "@/lib/fixtures";
import type { CompareSide } from "@/lib/compare/useComparePlayback";
import { CompareFixtureSelect } from "./CompareFixtureSelect";

const EMPTY_INSIGHTS_BY_LINE = new Map<number, never[]>();
const EMPTY_BREAKPOINTS = new Set<number>();

export interface CompareRunPanelProps {
  id: string;
  label: string;
  source: string;
  fixtureName: FixtureName;
  onFixtureChange: (name: FixtureName) => void;
  loading: boolean;
  side: CompareSide;
  pos: number;
  onScrub: (pos: number) => void;
}

/**
 * One side of Compare View: fixture picker, a read-only editor (the
 * props-driven `CodeEditorView`, fed by this side's own local playhead
 * instead of the page-wide `usePlayerStore`), and its own mini ribbon —
 * docs/PRD.md §6.4's panel-chrome language (hairline border, mono-label
 * uppercase header) via `@oocc/ui`'s `Panel`, same as every other panel in
 * the app.
 */
export function CompareRunPanel({
  id,
  label,
  source,
  fixtureName,
  onFixtureChange,
  loading,
  side,
  pos,
  onScrub,
}: CompareRunPanelProps) {
  const step = side.trace.steps[pos];
  const topFrame = step?.stack[step.stack.length - 1];

  const dots = useMemo(() => {
    if (!topFrame) return [];
    return Object.keys(topFrame.locals).map((name) => ({ name, channel: side.channels.get(name) ?? 1 }));
  }, [topFrame, side.channels]);

  const stepCount = side.trace.steps.length;

  return (
    <Panel
      title={label}
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      actions={
        <CompareFixtureSelect id={id} value={fixtureName} onChange={onFixtureChange} disabled={loading} />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-rule px-2 py-1">
          <Chip tone="neutral">{side.trace.language}</Chip>
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            step {pos} / {Math.max(0, stepCount - 1)}
            {step ? ` · line ${step.line}` : ""}
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <CodeEditorView
            className="h-full"
            sourceCode={source}
            language={side.trace.language}
            currentLine={step?.line ?? 0}
            breakpoints={EMPTY_BREAKPOINTS}
            dots={dots}
            insightsByLine={EMPTY_INSIGHTS_BY_LINE}
            onToggleBreakpoint={() => {}}
            onInsightLineClick={() => {}}
          />
        </div>

        <div className="border-t border-rule px-2 py-1.5">
          <MiniRibbon ticks={side.ticks} currentStep={pos} onScrub={onScrub} />
        </div>
      </div>
    </Panel>
  );
}
