"use client";

import { usePlayerStore } from "@/lib/player";
import { computeConsoleLines } from "@/lib/panels/consoleDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useMemo } from "react";

/** stdout lines tagged with the step that printed them; click a line to
 * scrub there. */
export function ConsolePanel() {
  const trace = usePlayerStore((state) => state.trace);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const jumpTo = usePlayerStore((state) => state.jumpTo);

  const allLines = useMemo(() => (trace ? computeConsoleLines(trace) : []), [trace]);
  const visibleLines = useMemo(
    () => allLines.filter((line) => line.stepIndex <= currentStep),
    [allLines, currentStep],
  );

  return (
    <Panel title="Console" className="min-h-0 flex-1" bodyClassName="overflow-auto p-3">
      {visibleLines.length > 0 ? (
        <div className="flex flex-col gap-0.5" data-testid="console-lines">
          {visibleLines.map((line, i) => (
            <button
              key={i}
              type="button"
              data-testid={`console-line-${i}`}
              onClick={() => jumpTo(line.stepIndex)}
              className="flex gap-2 rounded-control px-1 py-0.5 text-left font-mono-label text-[12px] hover:bg-paper"
            >
              <span className="shrink-0 text-ink-soft">{line.stepIndex}</span>
              <span className="whitespace-pre-wrap text-ink">{line.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No output yet" description="Nothing has been printed up to this step." />
      )}
    </Panel>
  );
}
