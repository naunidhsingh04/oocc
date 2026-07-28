"use client";

import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { useEffect, useRef } from "react";
import { ooccEditorTheme, ooccSyntaxHighlighting } from "@/components/editor/theme";
import { useCompilerHighlight } from "@/lib/compiler/highlightStore";
import type { AstNode, PipelineError } from "@/lib/compiler/types";
import { findEnclosingNodeId } from "@/lib/compiler/astIndex";
import type { buildAstIndex } from "@/lib/compiler/astIndex";

const setSelectedMark = Decoration.mark({ class: "cm-oocc-cx-selected" });
const setHoverMark = Decoration.mark({ class: "cm-oocc-cx-hover" });
const setErrorMark = Decoration.mark({ class: "cm-oocc-cx-error" });

const setDecorationsEffect = StateEffect.define<{
  selected: [number, number] | null;
  hover: [number, number] | null;
  error: [number, number] | null;
}>();

const decorationsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setDecorationsEffect)) continue;
      const { selected, hover, error } = effect.value;
      const marks = [];
      const docLength = tr.state.doc.length;
      const clamp = (n: number) => Math.min(Math.max(n, 0), docLength);
      if (error && clamp(error[0]) < clamp(error[1])) {
        marks.push(setErrorMark.range(clamp(error[0]), clamp(error[1])));
      }
      if (selected && clamp(selected[0]) < clamp(selected[1])) {
        marks.push(setSelectedMark.range(clamp(selected[0]), clamp(selected[1])));
      }
      if (hover && clamp(hover[0]) < clamp(hover[1])) {
        marks.push(setHoverMark.range(clamp(hover[0]), clamp(hover[1])));
      }
      marks.sort((a, b) => a.from - b.from || a.to - b.to);
      deco = Decoration.set(marks, true);
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const cxTheme = EditorView.theme({
  ".cm-oocc-cx-selected": { backgroundColor: "color-mix(in srgb, var(--color-signal) 22%, transparent)" },
  ".cm-oocc-cx-hover": { backgroundColor: "color-mix(in srgb, var(--color-signal) 10%, transparent)" },
  ".cm-oocc-cx-error": {
    textDecoration: "underline wavy var(--color-mutate)",
    textDecorationThickness: "2px",
  },
});

export interface SourcePaneProps {
  source: string;
  onChange: (source: string) => void;
  ast: AstNode | null;
  astIndex: ReturnType<typeof buildAstIndex> | null;
  error?: PipelineError | undefined;
  className?: string;
}

/**
 * The one editable pane (docs/PRD.md §7) — CodeMirror 6, no OOCC-lang
 * syntax package (this is a small teaching language with no published
 * CodeMirror mode, and precedence is illustrated by the AST/bytecode
 * panes, not syntax color), but the exact same CSS-var-driven theme the
 * main product's editor uses. Selecting/hovering source text resolves to
 * the innermost enclosing AST node (`findEnclosingNodeId`) and writes it
 * into the shared highlight store, same as every other pane.
 */
export function SourcePane({ source, onChange, ast, astIndex, error, className }: SourcePaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const astRef = useRef(ast);
  useEffect(() => {
    onChangeRef.current = onChange;
    astRef.current = ast;
  });

  const hoverAstId = useCompilerHighlight((s) => s.hoverAstId);
  const selectedAstId = useCompilerHighlight((s) => s.selectedAstId);
  const setHover = useCompilerHighlight((s) => s.setHover);
  const setSelected = useCompilerHighlight((s) => s.setSelected);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      doc: source,
      extensions: [
        ooccSyntaxHighlighting,
        ooccEditorTheme,
        cxTheme,
        decorationsField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.domEventHandlers({
          mousemove(event, view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null || !astRef.current) {
              setHover(null);
              return;
            }
            setHover(findEnclosingNodeId(astRef.current, pos));
          },
          mouseleave() {
            setHover(null);
          },
          click(event, view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null || !astRef.current) {
              setSelected(null);
              return;
            }
            setSelected(findEnclosingNodeId(astRef.current, pos));
          },
        }),
      ],
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once: `source` seeds the initial doc only (synced separately
    // below), and setHover/setSelected are stable zustand action refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === source) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: source } });
  }, [source]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const selectedNode = astIndex && selectedAstId !== null ? astIndex.get(selectedAstId) : null;
    const hoverNode = astIndex && hoverAstId !== null ? astIndex.get(hoverAstId) : null;
    view.dispatch({
      effects: setDecorationsEffect.of({
        selected: selectedNode ? [selectedNode.span.start, selectedNode.span.end] : null,
        hover: hoverNode ? [hoverNode.span.start, hoverNode.span.end] : null,
        error: error ? [error.span.start, error.span.end] : null,
      }),
    });
  }, [astIndex, selectedAstId, hoverAstId, error]);

  return <div ref={hostRef} className={className} data-testid="compiler-source-pane" />;
}
