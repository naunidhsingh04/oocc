import type { LoopBracket, LoopScope } from "@/lib/player";
import type { RibbonColors } from "./colors";
import { stepToX, type TickBin } from "./tickBins";

export const BRACKET_ROW_HEIGHT = 7;
export const MAX_BRACKET_ROWS = 4;
const TICK_HEIGHT = 3;

export interface DrawRibbonParams {
  width: number;
  height: number;
  bins: readonly TickBin[];
  stepCount: number;
  maxDepth: number;
  loopBrackets: readonly LoopBracket[];
  loopScope: LoopScope | null;
  playheadStep: number;
  hoverStep: number | null;
  pulseStep?: number | null;
  colors: RibbonColors;
}

export function bracketAreaHeight(loopBrackets: readonly LoopBracket[]): number {
  if (loopBrackets.length === 0) return 0;
  const maxRow = loopBrackets.reduce((max, b) => Math.max(max, Math.min(b.depth, MAX_BRACKET_ROWS - 1)), 0);
  return (maxRow + 1) * BRACKET_ROW_HEIGHT + 4;
}

function tickFillStyle(bin: TickBin, colors: RibbonColors): string {
  switch (bin.category) {
    case "exception":
      return colors.mutate;
    case "call":
      return colors.signal;
    case "return":
      return colors.signalMuted;
    case "assignment":
      return bin.channel ? (colors.channels[bin.channel - 1] ?? colors.signal) : colors.inkSoft;
    case "stdout":
      return colors.inkSoft;
    case "comparison":
    default:
      return colors.rule;
  }
}

export function drawRibbon(ctx: CanvasRenderingContext2D, params: DrawRibbonParams): void {
  const { width, height, bins, stepCount, maxDepth, loopBrackets, loopScope, playheadStep, hoverStep, pulseStep, colors } =
    params;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.paper;
  ctx.fillRect(0, 0, width, height);

  const bracketHeight = bracketAreaHeight(loopBrackets);
  const tickTop = bracketHeight;
  const tickAreaHeight = Math.max(1, height - tickTop);
  const usableTickHeight = Math.max(1, tickAreaHeight - TICK_HEIGHT - 2);
  const depthRange = Math.max(1, maxDepth);

  if (loopScope) {
    const x1 = stepToX(loopScope.start, stepCount, width);
    const x2 = stepToX(loopScope.end, stepCount, width);
    ctx.fillStyle = "rgba(27, 77, 228, 0.08)";
    ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height);
  }

  for (const bracket of loopBrackets) {
    const row = Math.min(bracket.depth, MAX_BRACKET_ROWS - 1);
    const y = bracketHeight - (row + 1) * BRACKET_ROW_HEIGHT + BRACKET_ROW_HEIGHT / 2;
    const x1 = stepToX(bracket.startStep, stepCount, width);
    const x2 = Math.max(x1 + 1, stepToX(bracket.endStep, stepCount, width));

    ctx.strokeStyle = colors.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    ctx.fillStyle = colors.inkSoft;
    for (const iterStep of bracket.iterationStarts) {
      const x = stepToX(iterStep, stepCount, width);
      ctx.fillRect(x - 0.5, y - 2, 1, 4);
    }
  }

  for (const bin of bins) {
    const y = tickTop + 1 + usableTickHeight - (bin.maxDepth / depthRange) * usableTickHeight;
    ctx.fillStyle = tickFillStyle(bin, colors);
    ctx.fillRect(bin.x, y, bin.width, TICK_HEIGHT);
  }

  if (hoverStep !== null && hoverStep !== playheadStep) {
    const x = stepToX(hoverStep, stepCount, width);
    ctx.strokeStyle = colors.inkSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // A one-shot highlight for a step a tutor/narration/step-chip click just
  // jumped to (`usePlayerStore.pulseStep`, self-clears after 900ms) — drawn
  // as a static wide band, not a fading/looping animation, so it already
  // reads as an instant state change under `prefers-reduced-motion`
  // without needing a separate reduced-motion branch (docs/PRD.md §9).
  if (pulseStep !== null && pulseStep !== undefined) {
    const x = stepToX(pulseStep, stepCount, width);
    ctx.fillStyle = colors.mutate;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x - 4, 0, 8, height);
    ctx.globalAlpha = 1;
  }

  const playheadX = stepToX(playheadStep, stepCount, width);
  ctx.strokeStyle = colors.signal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, height);
  ctx.stroke();
}

/** Mirrors the bracket-row layout in `drawRibbon` to find what a click landed on. */
export function hitTestBracket(
  x: number,
  y: number,
  params: { width: number; stepCount: number; loopBrackets: readonly LoopBracket[] },
): LoopBracket | null {
  const { width, stepCount, loopBrackets } = params;
  const bracketHeight = bracketAreaHeight(loopBrackets);
  if (y > bracketHeight) return null;

  let hit: LoopBracket | null = null;
  for (const bracket of loopBrackets) {
    const row = Math.min(bracket.depth, MAX_BRACKET_ROWS - 1);
    const rowTop = bracketHeight - (row + 1) * BRACKET_ROW_HEIGHT;
    const rowBottom = rowTop + BRACKET_ROW_HEIGHT;
    if (y < rowTop || y > rowBottom) continue;

    const x1 = stepToX(bracket.startStep, stepCount, width);
    const x2 = Math.max(x1 + 1, stepToX(bracket.endStep, stepCount, width));
    if (x < x1 - 2 || x > x2 + 2) continue;

    // Prefer the most deeply nested bracket under the cursor.
    if (!hit || bracket.depth > hit.depth) hit = bracket;
  }
  return hit;
}
