"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { valueToDisplay } from "@/lib/panels/heapValue";
import { EmptyState, Panel } from "@oocc/ui";

/** Frames as a physical stack, args visible, active frame in signal color.
 * `step.stack` (index 0 = outermost) already *is* the call stack — no
 * detection module needed, this panel just renders it. */
export function CallStackPanel() {
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));
  const frames = step?.stack ?? [];

  return (
    <Panel title="Call Stack" className="min-h-0 flex-1" bodyClassName="overflow-auto p-4">
      {frames.length > 0 ? (
        <div className="flex flex-col-reverse gap-1" data-testid="call-stack-frames">
          {frames.map((frame, index) => {
            const active = index === frames.length - 1;
            const args = frame.args ?? [];
            return (
              <div
                key={frame.frame_id}
                data-testid={`call-stack-frame-${frame.frame_id}`}
                data-active={active}
                className="rounded-control border px-3 py-2 font-mono-label text-[12px] transition-colors"
                style={{
                  borderColor: active ? "var(--color-signal)" : "var(--color-rule)",
                  backgroundColor: active ? "color-mix(in srgb, var(--color-signal) 10%, var(--color-panel))" : "var(--color-panel)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{frame.func}</span>
                  <span className="text-ink-soft">line {frame.line}</span>
                </div>
                {args.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-ink-soft">
                    {args.map((name) => (
                      <span key={name}>
                        {name}={String(valueToDisplay(frame.locals[name] ?? null))}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No active frames" description="This step has no call stack to show." />
      )}
    </Panel>
  );
}
