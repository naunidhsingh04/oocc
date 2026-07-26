"use client";

import { usePlayerStore } from "@/lib/player";
import { computeVariableHistories } from "@/lib/panels/variablesDetection";
import { EmptyState, Panel } from "@oocc/ui";
import { useEffect, useMemo, useRef } from "react";

const TRACK_HEIGHT = 28;
const LABEL_WIDTH = 64;

/**
 * Every variable's history as parallel channel-colored tracks under the
 * ribbon's time axis. Canvas, not DOM: this is the same "one draw call
 * covers the whole trace" requirement the ribbon itself has — a 40k-step
 * trace with 8 tracks would be hundreds of thousands of DOM nodes at 1px
 * granularity otherwise.
 */
export function TimelinePanel() {
  const trace = usePlayerStore((state) => state.trace);
  const channels = usePlayerStore((state) => state.channels);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const histories = useMemo(() => (trace ? computeVariableHistories(trace) : new Map()), [trace]);
  const rows = useMemo(
    () =>
      [...histories.entries()]
        .filter(([, values]) => values.length >= 2)
        .map(([name, values]) => ({ name, values, channel: channels.get(name) ?? 1 }))
        .sort((a, b) => a.channel - b.channel),
    [histories, channels],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !trace) return;

    const width = container.clientWidth;
    const height = rows.length * TRACK_HEIGHT;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const plotWidth = width - LABEL_WIDTH;
    const style = getComputedStyle(document.documentElement);

    rows.forEach((row, i) => {
      const top = i * TRACK_HEIGHT;
      const min = Math.min(...row.values);
      const max = Math.max(...row.values);
      const range = max - min || 1;
      const color = style.getPropertyValue(`--color-ch-${row.channel}`).trim() || "#888";

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      row.values.forEach((v: number, idx: number) => {
        const x = LABEL_WIDTH + (idx / (row.values.length - 1)) * plotWidth;
        const y = top + TRACK_HEIGHT - 4 - ((v - min) / range) * (TRACK_HEIGHT - 8);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = style.getPropertyValue("--color-ink-soft").trim() || "#666";
      ctx.font = "10px var(--font-mono-label, monospace)";
      ctx.fillText(row.name, 4, top + TRACK_HEIGHT / 2 + 3);
    });

    // Cursor line at the current step's position, scaled by total step count
    // (independent of each row's own downsampling stride).
    const totalSteps = trace.steps.length;
    if (totalSteps > 1) {
      const x = LABEL_WIDTH + (currentStep / (totalSteps - 1)) * plotWidth;
      ctx.strokeStyle = style.getPropertyValue("--color-signal").trim() || "#1b4de4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [rows, currentStep, trace]);

  return (
    <Panel title="Timeline" className="min-h-0 flex-1" bodyClassName="overflow-auto p-2">
      {rows.length > 0 ? (
        <div ref={containerRef} className="h-full w-full" data-testid="timeline-canvas-container">
          <canvas ref={canvasRef} data-testid="timeline-canvas" />
        </div>
      ) : (
        <EmptyState title="No numeric variables" description="No variable in this trace has a numeric history to plot." />
      )}
    </Panel>
  );
}
