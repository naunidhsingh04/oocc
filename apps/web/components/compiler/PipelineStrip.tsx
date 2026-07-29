"use client";

import { cn } from "@oocc/ui";
import type { CompilerLoadStage } from "@/lib/compiler/client";
import type { PipelineStage, StageTimings } from "@/lib/compiler/types";

const LOAD_STAGE_LABELS: Record<CompilerLoadStage, string> = {
  "loading-script": "loading compiler…",
  "initializing-wasm": "initializing wasm…",
  ready: "ready",
};

// `compiler.cpp` never throws an `OoccError` in this language (verified
// against its source — every semantic check surfaces at runtime, e.g. an
// undefined-variable assignment fails at `SET_GLOBAL` time, not compile
// time), so "Compile" has no failure state of its own to highlight; only
// lex/parse/run map to a real `PipelineStage`.
const STAGES: Array<{ key: keyof StageTimings; label: string; failsAs: PipelineStage | null }> = [
  { key: "lex", label: "Lex", failsAs: "LexError" },
  { key: "parse", label: "Parse", failsAs: "ParseError" },
  { key: "compile", label: "Compile", failsAs: null },
  { key: "run", label: "Run", failsAs: "RuntimeError" },
];

export interface PipelineStripProps {
  timings: StageTimings | null;
  failedStage: PipelineStage | null;
  compiling: boolean;
  /** Real WASM-load progress on the very first compile (docs/PRD.md §9) — null once loaded. */
  loadStage?: CompilerLoadStage | null;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1) return "<1ms";
  return `${ms.toFixed(1)}ms`;
}

/**
 * The pipeline strip (docs/PRD.md §7): lex/parse/compile/run with
 * per-stage timing, mutate-highlighting whichever stage failed.
 */
export function PipelineStrip({ timings, failedStage, compiling, loadStage }: PipelineStripProps) {
  return (
    <div
      className="flex h-8 shrink-0 items-center gap-4 border-b border-rule bg-panel px-3"
      data-testid="compiler-pipeline-strip"
    >
      {STAGES.map((stage) => {
        const failed = stage.failsAs !== null && failedStage === stage.failsAs;
        const value = timings?.[stage.key] ?? null;
        return (
          <div key={stage.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-mono-label text-[11px] uppercase tracking-[0.06em]",
                failed ? "text-mutate" : "text-ink-soft",
              )}
            >
              {stage.label}
            </span>
            <span
              className={cn(
                "font-mono-label text-[11px] tabular-nums",
                failed ? "text-mutate" : value !== null ? "text-ink" : "text-ink-soft",
              )}
            >
              {failed ? "failed" : formatMs(value)}
            </span>
          </div>
        );
      })}
      {loadStage ? (
        <span
          className="ml-auto flex items-center gap-1.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft"
          role="status"
          data-testid="compiler-load-progress"
        >
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
          {LOAD_STAGE_LABELS[loadStage]}
        </span>
      ) : compiling ? (
        <span className="ml-auto font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          compiling…
        </span>
      ) : null}
    </div>
  );
}
