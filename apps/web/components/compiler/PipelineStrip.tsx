"use client";

import { motion, useReducedMotion } from "motion/react";
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
const STAGES: Array<{ key: keyof StageTimings; label: string; failsAs: PipelineStage | null; color: string }> = [
  { key: "lex", label: "Lex", failsAs: "LexError", color: "var(--color-stage-lex)" },
  { key: "parse", label: "Parse", failsAs: "ParseError", color: "var(--color-stage-parse)" },
  { key: "compile", label: "Compile", failsAs: null, color: "var(--color-stage-compile)" },
  { key: "run", label: "Run", failsAs: "RuntimeError", color: "var(--color-stage-run)" },
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
 * per-stage timing. Each stage's dot scales in the instant its timing
 * lands — "lighting up stage by stage" as a compile actually runs through
 * lex → parse → compile → run — rather than the whole strip updating at
 * once when the (non-streaming) worker response arrives.
 */
export function PipelineStrip({ timings, failedStage, compiling, loadStage }: PipelineStripProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      // `min-h-10` + `flex-wrap` (not a fixed `h-10`, no-wrap) — four
      // stages plus the load/compiling indicator measure ~425px, which a
      // 375px viewport can't fit on one row. Without wrapping, the row
      // didn't grow the page (AppShell's `overflow-y-auto` main resolves
      // `overflow-x` to `auto` too per the CSS overflow spec, so the
      // last stage was reachable only via a hidden horizontal swipe
      // inside that region) — found live, not visible from a page-level
      // scrollWidth check alone.
      className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule bg-panel px-4 py-1.5"
      data-testid="compiler-pipeline-strip"
    >
      {STAGES.map((stage) => {
        const failed = stage.failsAs !== null && failedStage === stage.failsAs;
        const value = timings?.[stage.key] ?? null;
        const done = value !== null || failed;
        return (
          <div key={stage.key} className="flex items-center gap-2">
            <motion.span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: failed ? "var(--color-mutate)" : stage.color }}
              initial={false}
              animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
            />
            <span
              className={cn("font-body text-[13px] font-semibold transition-colors duration-150")}
              style={{ color: failed ? "var(--color-mutate)" : "var(--color-ink-soft)" }}
            >
              {stage.label}
            </span>
            <span
              className={cn(
                "font-mono-label text-[12px] tabular-nums transition-colors duration-150",
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
          className="ml-auto flex items-center gap-1.5 font-body text-[13px] font-medium text-ink-soft"
          role="status"
          data-testid="compiler-load-progress"
        >
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
          {LOAD_STAGE_LABELS[loadStage]}
        </span>
      ) : compiling ? (
        <span className="ml-auto font-body text-[13px] font-medium text-ink-soft">Compiling…</span>
      ) : null}
    </div>
  );
}
