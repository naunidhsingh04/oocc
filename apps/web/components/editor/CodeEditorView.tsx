"use client";

import type { Insight } from "@oocc/contracts";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, type StateEffect } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { breakpointGutter } from "./breakpointGutter";
import { channelDotsGutter } from "./channelDotsGutter";
import { insightGutter, onInsightGutterClickFacet, setInsightLinesEffect } from "./insightGutter";
import {
  type ChannelDot,
  currentLineField,
  onToggleBreakpointFacet,
  setBreakpointsEffect,
  setChannelDotsEffect,
  setCurrentLineEffect,
} from "./state";
import { ooccEditorTheme, ooccSyntaxHighlighting } from "./theme";

export interface EditorSelection {
  label: string;
  code: string;
}

export interface CodeEditorViewProps {
  className?: string | undefined;
  sourceCode: string;
  language: "python" | "cpp" | undefined;
  currentLine: number;
  breakpoints: ReadonlySet<number>;
  dots: ChannelDot[];
  insightsByLine: ReadonlyMap<number, Insight[]>;
  onToggleBreakpoint: (line: number) => void;
  onInsightLineClick: (firstStepRef: number) => void;
  onSelectionChange?: (selection: EditorSelection | null) => void;
}

function languageExtension(language: "python" | "cpp" | undefined) {
  return language === "cpp" ? cpp() : python();
}

/**
 * The props-driven CodeMirror 6 view every editor instance in the app
 * mounts — current-line highlighting, a click-to-toggle breakpoint gutter,
 * channel-color dots for the variables live on the current line, and an
 * insight-severity gutter (docs/PRD.md §6.2/§6.4). Extracted from
 * `CodeEditor.tsx` (Phase 5 frontend, compare view) so a second, independent
 * playhead (Compare View's two runs) can mount a second editor instance fed
 * by its own local state instead of the page-wide `usePlayerStore`
 * singleton — `CodeEditor.tsx` itself is now a thin wrapper that reads the
 * store and forwards props here, so the main workspace's behavior is
 * unchanged. Read-only: Phase 1 has no run pipeline to re-trace edited code
 * against.
 */
export function CodeEditorView({
  className,
  sourceCode,
  language,
  currentLine,
  breakpoints,
  dots,
  insightsByLine,
  onToggleBreakpoint,
  onInsightLineClick,
  onSelectionChange,
}: CodeEditorViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentRef = useRef(new Compartment());

  // Refs so the mount-once effect's event handlers always call the latest
  // callback without needing to be in that effect's own dependency array
  // (which would force a full remount, discarding undo history/scroll).
  // Assigned in an effect, not during render (`react-hooks/refs`) — the
  // assignment only needs to land before the next DOM event fires it, which
  // is always after this render has committed.
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);
  const onInsightLineClickRef = useRef(onInsightLineClick);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const insightsByLineRef = useRef(insightsByLine);
  useEffect(() => {
    onToggleBreakpointRef.current = onToggleBreakpoint;
    onInsightLineClickRef.current = onInsightLineClick;
    onSelectionChangeRef.current = onSelectionChange;
    insightsByLineRef.current = insightsByLine;
  });

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
          compartmentRef.current.of(languageExtension(language)),
          ooccSyntaxHighlighting,
          ooccEditorTheme,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          onToggleBreakpointFacet.of((line) => onToggleBreakpointRef.current(line)),
          onInsightGutterClickFacet.of((line) => {
            const insightsHere = insightsByLineRef.current.get(line);
            const firstStepRef = insightsHere?.[0]?.step_refs[0];
            if (firstStepRef !== undefined) onInsightLineClickRef.current(firstStepRef);
          }),
          EditorView.updateListener.of((update) => {
            if (!update.selectionSet || !onSelectionChangeRef.current) return;
            const { from, to } = update.state.selection.main;
            if (from === to) {
              onSelectionChangeRef.current(null);
              return;
            }
            const code = update.state.sliceDoc(from, to);
            const startLine = update.state.doc.lineAt(from).number;
            const endLine = update.state.doc.lineAt(to).number;
            const label = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
            onSelectionChangeRef.current({ label, code });
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once: every value read above is either a stable ref or synced
    // through its own effect below.
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
  // Compartment reconfigure preserves undo history/scroll position, which a
  // full remount would silently discard.
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
