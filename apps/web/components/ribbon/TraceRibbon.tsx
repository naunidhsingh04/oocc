"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readRibbonColors } from "./colors";
import { describeChange } from "./describeChange";
import { drawRibbon, hitTestBracket } from "./draw";
import { computeTickBins, xToStep } from "./tickBins";

// Fallback only, used for one frame before the container's real height is
// ever measured (see `containerHeight` below) — the ribbon now lives in
// its own user-resizable pane (Workspace.tsx's vertical split) and fills
// whatever height that pane is actually given, rather than computing one
// itself. That's also what makes the pane draggable in a way that's
// visible: a self-computed height would just get overridden every render.
const FALLBACK_RIBBON_HEIGHT = 70;

/**
 * The signature element (docs/PRD.md §6.3): a full-width, canvas-rendered
 * ribbon of one 2px tick per step, loop iterations as nested brackets, and
 * recursion depth as vertical offset. Ticks are binned once per resize (see
 * tickBins.ts) — every scrub/hover/playback redraw is O(canvas width), so
 * it holds 60fps even on the 40k-step fixture.
 */
export function TraceRibbon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();

  const trace = usePlayerStore((state) => state.trace);
  const ticks = usePlayerStore((state) => state.ticks);
  const loopBrackets = usePlayerStore((state) => state.loopBrackets);
  const loopScope = usePlayerStore((state) => state.loopScope);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const pulseStep = usePlayerStore((state) => state.pulseStep);
  const jumpTo = usePlayerStore((state) => state.jumpTo);
  const setLoopScope = usePlayerStore((state) => state.setLoopScope);

  const stepCount = trace?.steps.length ?? 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect === undefined) return;
      setContainerWidth(rect.width);
      setContainerHeight(rect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bins = useMemo(() => computeTickBins(ticks, containerWidth), [ticks, containerWidth]);
  const maxDepth = useMemo(() => ticks.reduce((max, t) => Math.max(max, t.depth), 0), [ticks]);
  const height = containerHeight || FALLBACK_RIBBON_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || containerWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = readRibbonColors(container);
    drawRibbon(ctx, {
      width: containerWidth,
      height,
      bins,
      stepCount,
      maxDepth,
      loopBrackets,
      loopScope,
      playheadStep: currentStep,
      hoverStep,
      pulseStep,
      colors,
    });
    // resolvedTheme isn't read directly but its change is what makes the
    // CSS custom properties resolve to different values on the next paint.
  }, [
    bins,
    stepCount,
    maxDepth,
    loopBrackets,
    loopScope,
    currentStep,
    hoverStep,
    pulseStep,
    containerWidth,
    height,
    resolvedTheme,
  ]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (stepCount === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      setHoverStep(xToStep(x, stepCount, rect.width));
    },
    [stepCount],
  );

  const handlePointerLeave = useCallback(() => setHoverStep(null), []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (stepCount === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const bracket = hitTestBracket(x, y, { width: rect.width, stepCount, loopBrackets });
      if (bracket) {
        setLoopScope({ start: bracket.startStep, end: bracket.endStep });
        jumpTo(bracket.startStep);
        return;
      }

      jumpTo(xToStep(x, stepCount, rect.width));
    },
    [stepCount, loopBrackets, setLoopScope, jumpTo],
  );

  const hoverInfo = useMemo(() => {
    if (hoverStep === null || !trace) return null;
    const step = getStateAt(trace, hoverStep);
    if (!step) return null;
    const change = describeChange(step);
    return { line: step.line, change };
  }, [hoverStep, trace]);

  return (
    <div ref={containerRef} data-tour="ribbon" className="relative min-h-0 w-full flex-1 border-t border-rule bg-paper">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block cursor-pointer"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        role="slider"
        aria-label="Trace ribbon — arrow keys step, shift-arrow jumps 10, Home/End jump to the ends"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, stepCount - 1)}
        aria-valuenow={currentStep}
        aria-valuetext={`Step ${currentStep} of ${Math.max(0, stepCount - 1)}`}
      />
      {hoverInfo ? (
        <div
          className="pointer-events-none absolute top-1 rounded-control border border-rule bg-panel px-2 py-1 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink shadow-menu"
          style={{
            left: `${Math.min(containerWidth - 140, Math.max(0, (hoverStep! / Math.max(1, stepCount - 1)) * containerWidth))}px`,
          }}
        >
          line {hoverInfo.line}
          {hoverInfo.change ? ` · ${hoverInfo.change}` : ""}
        </div>
      ) : null}
      {!trace ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          Choose a fixture to see its trace ribbon
        </div>
      ) : null}
    </div>
  );
}
