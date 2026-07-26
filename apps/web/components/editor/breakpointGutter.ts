import type { Extension } from "@codemirror/state";
import { gutter, GutterMarker } from "@codemirror/view";
import { breakpointsField, onToggleBreakpointFacet } from "./state";

class BreakpointMarker extends GutterMarker {
  eq(other: GutterMarker): boolean {
    return other instanceof BreakpointMarker;
  }
  toDOM(): Node {
    const dot = document.createElement("span");
    dot.className = "cm-oocc-breakpoint-dot";
    return dot;
  }
}

const breakpointMarker = new BreakpointMarker();

/** Click any line in this gutter to toggle a breakpoint there. */
export function breakpointGutter(): Extension {
  return [
    breakpointsField,
    gutter({
      class: "cm-oocc-breakpoint-gutter",
      // Every line needs a clickable cell, not just ones that already have
      // a breakpoint — otherwise there's nothing to click to add the first
      // one.
      renderEmptyElements: true,
      lineMarkerChange: () => true,
      lineMarker(view, line) {
        const lineNumber = view.state.doc.lineAt(line.from).number;
        return view.state.field(breakpointsField).has(lineNumber) ? breakpointMarker : null;
      },
      domEventHandlers: {
        mousedown(view, line) {
          const lineNumber = view.state.doc.lineAt(line.from).number;
          view.state.facet(onToggleBreakpointFacet)(lineNumber);
          return true;
        },
      },
    }),
  ];
}
