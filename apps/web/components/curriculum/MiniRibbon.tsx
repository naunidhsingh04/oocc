"use client";

import type { LoopScope } from "@/lib/player";
import type { TickInfo } from "@/lib/player/ticks";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readRibbonColors } from "@/components/ribbon/colors";
import { drawRibbon } from "@/components/ribbon/draw";
import { computeTickBins, xToStep } from "@/components/ribbon/tickBins";

const MINI_RIBBON_HEIGHT = 28;

export interface MiniRibbonProps {
  ticks: readonly TickInfo[];
  currentStep: number;
  onScrub: (step: number) => void;
}

/**
 * The Trace Ribbon (docs/PRD.md §6.3), shrunk for one embedded curriculum
 * code block — same drawing primitives as the full-width workspace ribbon
 * (`drawRibbon`, `computeTickBins`, `readRibbonColors`), just no loop
 * brackets (an article's embedded example is short enough that iteration
 * structure reads fine from the ticks alone) and driven by local props
 * instead of the global player store, since a single article page can
 * embed many of these at once.
 */
export function MiniRibbon({ ticks, currentStep, onScrub }: MiniRibbonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const { resolvedTheme } = useTheme();

  const stepCount = ticks.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bins = useMemo(() => computeTickBins(ticks, width), [ticks, width]);
  const maxDepth = useMemo(() => ticks.reduce((max, t) => Math.max(max, t.depth), 0), [ticks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = MINI_RIBBON_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${MINI_RIBBON_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = readRibbonColors(container);
    const noScope: LoopScope | null = null;
    drawRibbon(ctx, {
      width,
      height: MINI_RIBBON_HEIGHT,
      bins,
      stepCount,
      maxDepth,
      loopBrackets: [],
      loopScope: noScope,
      playheadStep: currentStep,
      hoverStep: null,
      colors,
    });
    // resolvedTheme isn't read directly but its change is what makes the
    // CSS custom properties resolve to different values on the next paint.
  }, [bins, stepCount, maxDepth, currentStep, width, resolvedTheme]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (stepCount === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      onScrub(xToStep(event.clientX - rect.left, stepCount, rect.width));
    },
    [stepCount, onScrub],
  );

  return (
    <div ref={containerRef} className="w-full" style={{ height: MINI_RIBBON_HEIGHT }}>
      <canvas
        ref={canvasRef}
        className="block cursor-pointer"
        onClick={handleClick}
        role="slider"
        aria-label="Embedded trace ribbon"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, stepCount - 1)}
        aria-valuenow={currentStep}
      />
    </div>
  );
}
