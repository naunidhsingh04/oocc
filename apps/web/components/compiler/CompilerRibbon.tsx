"use client";

import type { LoopScope } from "@/lib/player";
import type { TickInfo } from "@/lib/player/ticks";
import { readRibbonColors } from "@/components/ribbon/colors";
import { drawRibbon } from "@/components/ribbon/draw";
import { computeTickBins, xToStep } from "@/components/ribbon/tickBins";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RIBBON_HEIGHT = 40;

export interface CompilerRibbonProps {
  ticks: readonly TickInfo[];
  currentStep: number;
  onScrub: (step: number) => void;
}

/**
 * The Trace Ribbon, adapted for VM steps (docs/PRD.md §7: "reuse the
 * player and the ribbon... do not build a second playback system") — same
 * drawing primitives as the main workspace ribbon and `MiniRibbon`
 * (`drawRibbon`/`computeTickBins`/`readRibbonColors`), driven by local
 * props instead of the global player store, since this page's VM steps
 * aren't a `@oocc/contracts` `Trace` and can't go through the singleton.
 */
export function CompilerRibbon({ ticks, currentStep, onScrub }: CompilerRibbonProps) {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = RIBBON_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${RIBBON_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = readRibbonColors(container);
    const noScope: LoopScope | null = null;
    drawRibbon(ctx, {
      width,
      height: RIBBON_HEIGHT,
      bins,
      stepCount,
      maxDepth: 0,
      loopBrackets: [],
      loopScope: noScope,
      playheadStep: currentStep,
      hoverStep: null,
      colors,
    });
    // resolvedTheme isn't read directly but its change is what makes the
    // CSS custom properties resolve to different values on the next paint.
  }, [bins, stepCount, currentStep, width, resolvedTheme]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (stepCount === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      onScrub(xToStep(event.clientX - rect.left, stepCount, rect.width));
    },
    [stepCount, onScrub],
  );

  // Local-state-driven like MiniRibbon, so it needs its own key handler
  // rather than relying on the workspace's global keyboard shortcuts.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (stepCount === 0) return;
      const last = stepCount - 1;
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          onScrub(Math.min(last, currentStep + (event.shiftKey ? 10 : 1)));
          break;
        case "ArrowLeft":
          event.preventDefault();
          onScrub(Math.max(0, currentStep - (event.shiftKey ? 10 : 1)));
          break;
        case "Home":
          event.preventDefault();
          onScrub(0);
          break;
        case "End":
          event.preventDefault();
          onScrub(last);
          break;
        default:
          break;
      }
    },
    [stepCount, currentStep, onScrub],
  );

  return (
    <div ref={containerRef} className="w-full shrink-0" style={{ height: RIBBON_HEIGHT }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block cursor-pointer"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-label="VM step ribbon — arrow keys step, shift-arrow jumps 10, Home/End jump to the ends"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, stepCount - 1)}
        aria-valuenow={currentStep}
        aria-valuetext={`Step ${currentStep} of ${Math.max(0, stepCount - 1)}`}
      />
    </div>
  );
}
