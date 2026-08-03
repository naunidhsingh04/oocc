"use client";

import { usePlayerStore } from "@/lib/player";
import { EMPTY_INSIGHTS, groupInsightsBySeverity, SEVERITY_ORDER, SEVERITY_TONE } from "@/lib/insights/insightsView";
import { Chip, EmptyState, Panel } from "@oocc/ui";
import { useState } from "react";

const SEVERITY_LABEL = { error: "Error", warning: "Warning", info: "Info" } as const;

/**
 * Scanner findings, grouped by severity using only the ok/warn/mutate
 * tokens from PRD §6.2 (never a new color) — collapsible per group, each
 * finding with a "show me" action that scrubs to its evidence
 * (docs/PRD.md Phase 3 frontend spec item 3). The same findings also
 * render as gutter dots in the editor (see insightGutter.ts); this list is
 * the other half of the same data.
 */
export function InsightsPanel() {
  const insights = usePlayerStore((state) => state.analysis?.insights ?? EMPTY_INSIGHTS);
  const narrations = usePlayerStore((state) => state.narration.insights);
  const jumpToStepRef = usePlayerStore((state) => state.jumpToStepRef);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // The whole panel starts as a one-line summary, not just its severity
  // subgroups — a full-height empty-looking box for "0 findings" (the
  // common case) was exactly the kind of dead space the layout rebalance
  // was about removing. Any findings still collapse by default; expanding
  // is one click on the summary line either way.
  const [expanded, setExpanded] = useState(false);

  const groups = groupInsightsBySeverity(insights, narrations);

  function toggleGroup(severity: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  }

  const summary =
    insights.length === 0 ? "No findings" : `${insights.length} finding${insights.length === 1 ? "" : "s"}`;

  return (
    <Panel
      title="Insights"
      className={expanded ? "min-h-0 flex-1" : "shrink-0"}
      bodyClassName={expanded ? "overflow-auto p-2" : "p-0"}
      actions={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:text-ink"
        >
          {summary} {expanded ? "▾" : "▸"}
        </button>
      }
    >
      {!expanded ? null : insights.length === 0 ? (
        <EmptyState title="No findings" description="The deterministic scanners found nothing to flag in this run." />
      ) : (
        <div className="flex flex-col gap-2" data-testid="insights-groups">
          {SEVERITY_ORDER.filter((severity) => groups[severity].length > 0).map((severity) => {
            const collapsed = collapsedGroups.has(severity);
            return (
              <div key={severity}>
                <button
                  type="button"
                  onClick={() => toggleGroup(severity)}
                  className="flex w-full items-center gap-2 rounded-control px-1 py-1 text-left hover:bg-paper"
                  aria-expanded={!collapsed}
                >
                  <span aria-hidden className="font-mono-label text-[10px] text-ink-soft">
                    {collapsed ? "▸" : "▾"}
                  </span>
                  <Chip tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Chip>
                  <span className="font-mono-label text-[11px] text-ink-soft">{groups[severity].length}</span>
                </button>
                {!collapsed ? (
                  <div className="flex flex-col gap-1 pl-5">
                    {groups[severity].map(({ insight, narration, index }) => (
                      <div
                        key={index}
                        data-testid={`insight-${insight.kind}-${index}`}
                        className="rounded-control border border-rule p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink">
                            {insight.kind.replaceAll("_", " ")}
                          </span>
                          <button
                            type="button"
                            onClick={() => jumpToStepRef(insight.step_refs[0]!)}
                            className="font-mono-label text-[10px] uppercase tracking-[0.06em] text-signal hover:underline"
                          >
                            Show me
                          </button>
                        </div>
                        <p className="mt-1 font-body text-[12px] leading-snug text-ink-soft">
                          {narration ?? insight.detail ?? "No further detail."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
