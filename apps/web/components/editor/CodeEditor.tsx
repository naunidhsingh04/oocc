"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeInsightsByLine, EMPTY_INSIGHTS } from "@/lib/insights/insightsView";
import { useTutorStore } from "@/lib/tutor/store";
import { useMemo } from "react";
import { CodeEditorView, type EditorSelection } from "./CodeEditorView";

export interface CodeEditorProps {
  className?: string;
}

/**
 * The main workspace's editor — a thin wrapper over the props-driven
 * `CodeEditorView` (docs/PRD.md §6.2/§6.4) that reads everything from the
 * page-wide `usePlayerStore` singleton and forwards it as props. Split out
 * in Phase 5 frontend (compare view) so a second, independent trace
 * playhead can mount its own `CodeEditorView` fed by local state instead of
 * this store — see `components/compare/CompareCodeEditor.tsx`. Behavior
 * here is unchanged from before the split.
 */
export function CodeEditor({ className }: CodeEditorProps) {
  const sourceCode = usePlayerStore((state) => state.sourceCode);
  const language = usePlayerStore((state) => state.trace?.language);
  const currentLine = usePlayerStore((state) => getStateAt(state.trace, state.currentStep)?.line ?? 0);
  const topFrameLocalNames = usePlayerStore((state) => {
    const step = getStateAt(state.trace, state.currentStep);
    const top = step?.stack[step.stack.length - 1];
    return top ? Object.keys(top.locals).join(",") : "";
  });
  const breakpoints = usePlayerStore((state) => state.breakpoints);
  const channels = usePlayerStore((state) => state.channels);
  const toggleBreakpoint = usePlayerStore((state) => state.toggleBreakpoint);
  const jumpToStepRef = usePlayerStore((state) => state.jumpToStepRef);
  const trace = usePlayerStore((state) => state.trace);
  const insights = usePlayerStore((state) => state.analysis?.insights ?? EMPTY_INSIGHTS);

  const insightsByLine = useMemo(
    () => (trace ? computeInsightsByLine(trace, insights) : new Map()),
    [trace, insights],
  );

  const dots = useMemo(() => {
    if (!topFrameLocalNames) return [];
    return topFrameLocalNames.split(",").map((name) => ({ name, channel: channels.get(name) ?? 1 }));
  }, [topFrameLocalNames, channels]);

  function handleSelectionChange(selection: EditorSelection | null) {
    useTutorStore.getState().setPendingSelection(selection);
  }

  return (
    <CodeEditorView
      className={className}
      sourceCode={sourceCode}
      language={language}
      currentLine={currentLine}
      breakpoints={breakpoints}
      dots={dots}
      insightsByLine={insightsByLine}
      onToggleBreakpoint={toggleBreakpoint}
      onInsightLineClick={jumpToStepRef}
      onSelectionChange={handleSelectionChange}
    />
  );
}
