import { Facet, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

/**
 * CodeMirror's state here is a one-way projection of the player store: the
 * store is the source of truth, these fields just mirror it for rendering.
 * DOM events (clicking the breakpoint gutter) call back into the store via
 * `onToggleBreakpointFacet` instead of mutating these fields directly — the
 * next store update re-dispatches the effects below and CodeMirror repaints.
 */

export const setCurrentLineEffect = StateEffect.define<number>();

const currentLineMark = Decoration.line({ class: "cm-oocc-current-line" });

/** Highlights the 1-based source line currently executing, or none for 0. */
export const currentLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setCurrentLineEffect)) continue;
      const lineNumber = effect.value;
      if (lineNumber <= 0 || lineNumber > tr.state.doc.lines) {
        deco = Decoration.none;
      } else {
        const line = tr.state.doc.line(lineNumber);
        deco = Decoration.set([currentLineMark.range(line.from)]);
      }
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const setBreakpointsEffect = StateEffect.define<ReadonlySet<number>>();

export const breakpointsField = StateField.define<ReadonlySet<number>>({
  create: () => new Set(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointsEffect)) value = effect.value;
    }
    return value;
  },
});

export interface ChannelDot {
  name: string;
  channel: number;
}

export const setChannelDotsEffect = StateEffect.define<{ line: number; dots: ChannelDot[] }>();

/** The live-variable channel dots for whichever line they belong to (docs/PRD.md §6.2). */
export const channelDotsField = StateField.define<{ line: number; dots: ChannelDot[] }>({
  create: () => ({ line: 0, dots: [] }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setChannelDotsEffect)) value = effect.value;
    }
    return value;
  },
});

/** Line numbers are 1-based to match the trace contract's `line` field. */
export const onToggleBreakpointFacet = Facet.define<(line: number) => void, (line: number) => void>({
  combine: (values) => values[values.length - 1] ?? (() => {}),
});
