import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * One CodeMirror theme built from CSS custom properties instead of two
 * hardcoded palettes. docs/PRD.md §6.2's tokens already redefine themselves
 * under `[data-theme="dark"]` (see packages/ui/src/theme.css), so a single
 * `var(--color-*)`-driven theme repaints for both light and dark the moment
 * next-themes flips the attribute — no CodeMirror reconfiguration needed.
 */
export const ooccEditorTheme: Extension = EditorView.theme(
  {
    "&": {
      color: "var(--color-ink)",
      backgroundColor: "var(--color-panel)",
      fontFamily: "var(--font-editor)",
      fontSize: "14px",
      height: "100%",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-content": {
      fontFamily: "var(--font-editor)",
      lineHeight: "1.6",
      caretColor: "var(--color-signal)",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-signal)" },
    ".cm-scroller": { overflow: "auto" },
    ".cm-gutters": {
      backgroundColor: "var(--color-panel)",
      color: "var(--color-ink-soft)",
      border: "none",
      borderRight: "1px solid var(--color-rule)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      fontFamily: "var(--font-mono-label)",
      fontSize: "11px",
      padding: "0 6px 0 4px",
    },
    ".cm-oocc-current-line": {
      backgroundColor: "color-mix(in srgb, var(--color-signal) 12%, transparent)",
    },
    ".cm-oocc-breakpoint-gutter": {
      width: "14px",
      cursor: "pointer",
    },
    ".cm-oocc-breakpoint-dot": {
      display: "block",
      width: "8px",
      height: "8px",
      margin: "5px 3px",
      borderRadius: "50%",
      backgroundColor: "var(--color-mutate)",
    },
    ".cm-oocc-channel-dots-gutter": {
      minWidth: "10px",
      paddingRight: "2px",
    },
    ".cm-oocc-channel-dots": {
      display: "flex",
      alignItems: "center",
      gap: "2px",
      height: "100%",
      paddingLeft: "2px",
    },
    ".cm-oocc-channel-dot": {
      display: "inline-block",
      width: "5px",
      height: "5px",
      borderRadius: "50%",
    },
  },
  { dark: false },
);

const ooccHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--color-signal)" },
  { tag: [tags.controlKeyword, tags.operatorKeyword], color: "var(--color-signal)", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--color-ok)" },
  { tag: tags.number, color: "var(--color-warn)" },
  { tag: tags.comment, color: "var(--color-ink-soft)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.definition(tags.function(tags.variableName))], color: "var(--color-ch-5)" },
  { tag: tags.variableName, color: "var(--color-ink)" },
  { tag: tags.className, color: "var(--color-ch-6)" },
  { tag: tags.operator, color: "var(--color-ink-soft)" },
  { tag: tags.bool, color: "var(--color-warn)" },
  { tag: tags.null, color: "var(--color-warn)" },
]);

export const ooccSyntaxHighlighting: Extension = syntaxHighlighting(ooccHighlightStyle);
