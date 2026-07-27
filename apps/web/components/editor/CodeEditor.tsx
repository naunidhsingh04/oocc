"use client";

import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, type StateEffect } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { getStateAt, usePlayerStore } from "@/lib/player";
import { computeInsightsByLine, EMPTY_INSIGHTS } from "@/lib/insights/insightsView";
import { useTutorStore } from "@/lib/tutor/store";
import { useEffect, useMemo, useRef } from "react";
import { breakpointGutter } from "./breakpointGutter";
import { channelDotsGutter } from "./channelDotsGutter";
import { insightGutter, onInsightGutterClickFacet, setInsightLinesEffect } from "./insightGutter";
import {
  currentLineField,
  onToggleBreakpointFacet,
  setBreakpointsEffect,
  setChannelDotsEffect,
  setCurrentLineEffect,
} from "./state";
import { ooccEditorTheme, ooccSyntaxHighlighting } from "./theme";

export interface CodeEditorProps {
  className?: string;
}

/**
 * A read-only CodeMirror 6 view of the current fixture's source, with
 * playback-driven current-line highlighting, a click-to-toggle breakpoint
 * gutter, and channel-color dots for the variables live on the current
 * line (docs/PRD.md §6.2/§6.4). Read-only because Phase 1 has no run
 * pipeline to re-trace edited code against — Phase 2's run API is what
 * makes this editable.
 */
function languageExtension(language: "python" | "cpp" | undefined) {
  return language === "cpp" ? cpp() : python();
}

export function CodeEditor({ className }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentRef = useRef(new Compartment());

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

  // A ref, not a dependency the mount effect reconfigures on: the click
  // handler is registered once at mount (see the facet below) and always
  // reads the latest map through this instead.
  const insightsByLineRef = useRef(insightsByLine);
  insightsByLineRef.current = insightsByLine;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: "",
        extensions: [
          lineNumbers(),
          breakpointGutter(),
          channelDotsGutter(),
          insightGutter(),
          currentLineField,
          compartmentRef.current.of(languageExtension(usePlayerStore.getState().trace?.language)),
          ooccSyntaxHighlighting,
          ooccEditorTheme,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          onToggleBreakpointFacet.of((line) => toggleBreakpoint(line)),
          onInsightGutterClickFacet.of((line) => {
            const insightsHere = insightsByLineRef.current.get(line);
            const firstStepRef = insightsHere?.[0]?.step_refs[0];
            if (firstStepRef !== undefined) jumpToStepRef(firstStepRef);
          }),
          EditorView.updateListener.of((update) => {
            if (!update.selectionSet) return;
            const { from, to } = update.state.selection.main;
            if (from === to) {
              useTutorStore.getState().setPendingSelection(null);
              return;
            }
            const code = update.state.sliceDoc(from, to);
            const startLine = update.state.doc.lineAt(from).number;
            const endLine = update.state.doc.lineAt(to).number;
            const label = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
            useTutorStore.getState().setPendingSelection({ label, code });
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once: toggleBreakpoint is a stable zustand action reference,
    // and every other value below is synced through its own effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === sourceCode) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: sourceCode } });
  }, [sourceCode]);

  // Language selector (docs/PRD.md Phase 4 frontend): reconfigures the
  // CodeMirror language mode when the loaded trace's language changes,
  // rather than tearing down and remounting the whole EditorView — a
  // Compartment reconfigure preserves undo history/scroll/selection,
  // which a full remount would silently discard.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: compartmentRef.current.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const effects: StateEffect<unknown>[] = [setCurrentLineEffect.of(currentLine)];
    if (currentLine > 0 && currentLine <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(currentLine).from, { y: "center" }));
    }
    view.dispatch({ effects });
  }, [currentLine]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setBreakpointsEffect.of(breakpoints) });
  }, [breakpoints]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setChannelDotsEffect.of({ line: currentLine, dots }) });
  }, [currentLine, dots]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setInsightLinesEffect.of(insightsByLine) });
  }, [insightsByLine]);

  return <div ref={hostRef} className={className} data-testid="code-editor" />;
}
