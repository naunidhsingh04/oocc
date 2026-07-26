import type { Extension } from "@codemirror/state";
import { gutter, GutterMarker } from "@codemirror/view";
import { channelDotsField, type ChannelDot } from "./state";

class ChannelDotsMarker extends GutterMarker {
  constructor(readonly dots: ChannelDot[]) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof ChannelDotsMarker &&
      other.dots.length === this.dots.length &&
      other.dots.every((dot, i) => dot.channel === this.dots[i]?.channel && dot.name === this.dots[i]?.name)
    );
  }

  toDOM(): Node {
    const wrap = document.createElement("span");
    wrap.className = "cm-oocc-channel-dots";
    for (const dot of this.dots) {
      const el = document.createElement("span");
      el.className = "cm-oocc-channel-dot";
      el.style.backgroundColor = `var(--color-ch-${dot.channel})`;
      el.title = dot.name;
      wrap.appendChild(el);
    }
    return wrap;
  }
}

/**
 * Channel-color dots for the variables live on the current line only
 * (docs/PRD.md §6.2/§6.4) — every other line renders nothing in this
 * gutter.
 */
export function channelDotsGutter(): Extension {
  return [
    channelDotsField,
    gutter({
      class: "cm-oocc-channel-dots-gutter",
      lineMarkerChange: () => true,
      lineMarker(view, line) {
        const state = view.state.field(channelDotsField);
        if (state.dots.length === 0) return null;
        const lineNumber = view.state.doc.lineAt(line.from).number;
        return lineNumber === state.line ? new ChannelDotsMarker(state.dots) : null;
      },
    }),
  ];
}
