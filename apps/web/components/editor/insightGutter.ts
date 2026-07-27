import type { Insight } from "@oocc/contracts";
import { Facet, StateEffect, StateField } from "@codemirror/state";
import { gutter, GutterMarker } from "@codemirror/view";
import { SEVERITY_TONE, strongestSeverity, type SeverityTone } from "@/lib/insights/insightsView";

export const setInsightLinesEffect = StateEffect.define<ReadonlyMap<number, Insight[]>>();

export const insightLinesField = StateField.define<ReadonlyMap<number, Insight[]>>({
  create: () => new Map(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setInsightLinesEffect)) value = effect.value;
    }
    return value;
  },
});

/** Line numbers are 1-based, matching the trace contract's `line` field. */
export const onInsightGutterClickFacet = Facet.define<(line: number) => void, (line: number) => void>({
  combine: (values) => values[values.length - 1] ?? (() => {}),
});

const TONE_VAR: Record<SeverityTone, string> = {
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  mutate: "var(--color-mutate)",
};

class InsightMarker extends GutterMarker {
  constructor(
    readonly insights: Insight[],
    readonly tone: SeverityTone,
  ) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return other instanceof InsightMarker && other.tone === this.tone && other.insights.length === this.insights.length;
  }

  toDOM(): Node {
    const dot = document.createElement("span");
    dot.className = "cm-oocc-insight-dot";
    dot.style.backgroundColor = TONE_VAR[this.tone];
    dot.title = this.insights.map((i) => i.kind).join(", ");
    return dot;
  }
}

/** One dot per line with at least one insight finding, colored by the most
 * severe finding there (docs/PRD.md §6.2's ok/warn/mutate tokens only).
 * Click scrubs to that finding's first step_ref via
 * `onInsightGutterClickFacet` — the same "show me" action the insights
 * list itself offers. */
export function insightGutter(): import("@codemirror/state").Extension {
  return [
    insightLinesField,
    gutter({
      class: "cm-oocc-insight-gutter",
      lineMarkerChange: () => true,
      lineMarker(view, line) {
        const byLine = view.state.field(insightLinesField);
        const lineNumber = view.state.doc.lineAt(line.from).number;
        const insights = byLine.get(lineNumber);
        if (!insights || insights.length === 0) return null;
        return new InsightMarker(insights, SEVERITY_TONE[strongestSeverity(insights)]);
      },
      domEventHandlers: {
        mousedown(view, line) {
          const lineNumber = view.state.doc.lineAt(line.from).number;
          if (view.state.field(insightLinesField).has(lineNumber)) {
            view.state.facet(onInsightGutterClickFacet)(lineNumber);
          }
          return true;
        },
      },
    }),
  ];
}
