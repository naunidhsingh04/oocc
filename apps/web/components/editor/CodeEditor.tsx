"use client";

import { python } from "@codemirror/lang-python";
import { EditorState, type StateEffect } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { getStateAt, usePlayerStore } from "@/lib/player";
import { useEffect, useMemo, useRef } from "react";
import { breakpointGutter } from "./breakpointGutter";
import { channelDotsGutter } from "./channelDotsGutter";
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
export function CodeEditor({ className }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const sourceCode = usePlayerStore((state) => state.sourceCode);
  const currentLine = usePlayerStore((state) => getStateAt(state.trace, state.currentStep)?.line ?? 0);
  const topFrameLocalNames = usePlayerStore((state) => {
    const step = getStateAt(state.trace, state.currentStep);
    const top = step?.stack[step.stack.length - 1];
    return top ? Object.keys(top.locals).join(",") : "";
  });
  const breakpoints = usePlayerStore((state) => state.breakpoints);
  const channels = usePlayerStore((state) => state.channels);
  const toggleBreakpoint = usePlayerStore((state) => state.toggleBreakpoint);

  const dots = useMemo(() => {
    if (!topFrameLocalNames) return [];
    return topFrameLocalNames.split(",").map((name) => ({ name, channel: channels.get(name) ?? 1 }));
  }, [topFrameLocalNames, channels]);

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
          currentLineField,
          python(),
          ooccSyntaxHighlighting,
          ooccEditorTheme,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          onToggleBreakpointFacet.of((line) => toggleBreakpoint(line)),
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

  return <div ref={hostRef} className={className} data-testid="code-editor" />;
}
