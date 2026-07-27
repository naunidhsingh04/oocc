import type { Insight, Severity, Trace } from "@oocc/contracts";

/** A stable reference for "no insights yet" — a zustand selector must
 * never return a fresh `[]` literal (`state.analysis?.insights ?? []`),
 * since `useSyncExternalStore` compares snapshots by reference and a new
 * array every render reads as "changed every render", which is an
 * infinite update loop, not a quiet empty state. */
export const EMPTY_INSIGHTS: readonly Insight[] = [];

export type SeverityTone = "ok" | "warn" | "mutate";

/** docs/PRD.md §6.2's three severity tokens, never a new color — `error`
 * reuses `--mutate` (the "value that just changed" magenta) rather than
 * inventing a fourth severity color, per this phase's explicit brief. */
export const SEVERITY_TONE: Record<Severity, SeverityTone> = {
  info: "ok",
  warning: "warn",
  error: "mutate",
};

export const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];

export interface InsightWithNarration {
  insight: Insight;
  narration: string | null;
  index: number;
}

/** `step_refs` are real step *indices* (`step.i`), not array positions —
 * for a head+tail-truncated trace those differ (see
 * lib/player/ticks.ts's identical gotcha). Finds the source line for the
 * first step_ref actually present in this trace. */
export function lineForStepRef(trace: Trace, stepRef: number): number | null {
  const step = trace.steps.find((s) => s.i === stepRef);
  return step?.line ?? null;
}

/** line number -> every insight with evidence on that line, for the
 * CodeMirror gutter. */
export function computeInsightsByLine(
  trace: Trace,
  insights: readonly Insight[],
): Map<number, Insight[]> {
  const byLine = new Map<number, Insight[]>();
  for (const insight of insights) {
    const seen = new Set<number>();
    for (const stepRef of insight.step_refs) {
      const line = lineForStepRef(trace, stepRef);
      if (line === null || seen.has(line)) continue;
      seen.add(line);
      const existing = byLine.get(line);
      if (existing) existing.push(insight);
      else byLine.set(line, [insight]);
    }
  }
  return byLine;
}

export function groupInsightsBySeverity(
  insights: readonly Insight[],
  narrations: ReadonlyArray<string | null>,
): Record<Severity, InsightWithNarration[]> {
  const groups: Record<Severity, InsightWithNarration[]> = { error: [], warning: [], info: [] };
  insights.forEach((insight, index) => {
    groups[insight.severity].push({ insight, narration: narrations[index] ?? null, index });
  });
  return groups;
}

/** The strongest (lowest = most severe) tone among findings on one line —
 * a line with both a warning and an error shows as an error in the gutter. */
export function strongestSeverity(insights: readonly Insight[]): Severity {
  for (const severity of SEVERITY_ORDER) {
    if (insights.some((i) => i.severity === severity)) return severity;
  }
  return "info";
}
