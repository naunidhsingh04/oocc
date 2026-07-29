"use client";

import {
  IconButton,
  PauseIcon,
  PlayIcon,
  SkipToEndIcon,
  SkipToStartIcon,
  StepBackIcon,
  StepForwardIcon,
} from "@oocc/ui";
import type { TickInfo } from "@/lib/player/ticks";
import type { VmStep } from "@/lib/compiler/types";
import { CompilerRibbon } from "./CompilerRibbon";
import { GlobalsTable } from "./GlobalsTable";
import { StackView } from "./StackView";

export interface VmPaneProps {
  steps: readonly VmStep[];
  ticks: readonly TickInfo[];
  currentStep: number;
  step: VmStep | undefined;
  playing: boolean;
  lastIndex: number;
  jumpTo: (step: number) => void;
  stepBy: (delta: number) => void;
  togglePlay: () => void;
}

/**
 * The Run tab (docs/PRD.md §7): pc indicator (via `BytecodePane`'s
 * `currentPc` prop, driven by the same `step` this pane holds), an
 * animated stack, a globals table, output, and the ribbon reused for VM
 * steps — all one calm surface with spacing instead of borders between
 * its own sections, since it's the only tab open at a time now, not one
 * of five panes competing for a border.
 */
export function VmPane({
  steps,
  ticks,
  currentStep,
  step,
  playing,
  lastIndex,
  jumpTo,
  stepBy,
  togglePlay,
}: VmPaneProps) {
  const disabled = steps.length === 0;
  // Output as of the currently-scrubbed step, not the program's final
  // total — scrubbing back to step 3 must show only what had printed by
  // then, exactly like the main product's console panel.
  const stdoutSoFar = steps
    .slice(0, currentStep + 1)
    .map((s) => s.stdoutDelta)
    .join("");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3" data-testid="compiler-vm-pane">
      <div className="flex shrink-0 items-center gap-1">
        <IconButton aria-label="Jump to start" disabled={disabled} onClick={() => jumpTo(0)}>
          <SkipToStartIcon />
        </IconButton>
        <IconButton aria-label="Step backward" disabled={disabled} onClick={() => stepBy(-1)}>
          <StepBackIcon />
        </IconButton>
        <IconButton aria-label={playing ? "Pause" : "Play"} disabled={disabled} onClick={togglePlay} active={playing}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton aria-label="Step forward" disabled={disabled} onClick={() => stepBy(1)}>
          <StepForwardIcon />
        </IconButton>
        <IconButton aria-label="Jump to end" disabled={disabled} onClick={() => jumpTo(lastIndex)}>
          <SkipToEndIcon />
        </IconButton>
        <span className="ml-2 font-mono-label text-[12px] tabular-nums text-ink-soft">
          step {steps.length === 0 ? 0 : currentStep} / {lastIndex}
          {step ? ` · pc ${step.pc}` : ""}
        </span>
      </div>

      <CompilerRibbon ticks={ticks} currentStep={currentStep} onScrub={jumpTo} />

      <div className="grid min-h-0 grid-cols-2 gap-3">
        <div className="min-h-0 rounded-panel border border-rule">
          <div className="px-3 py-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            Stack
          </div>
          <div className="h-40">
            <StackView stack={step?.stackAfter ?? []} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col rounded-panel border border-rule">
          <div className="px-3 py-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            Globals
          </div>
          <div className="h-40 overflow-y-auto">
            <GlobalsTable globals={step?.globals ?? {}} />
          </div>
        </div>
      </div>

      <div className="min-h-24 shrink-0 rounded-panel border border-rule">
        <div className="px-3 py-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          Output
        </div>
        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap px-3 pb-2 font-editor text-[13px] text-ink">
          {stdoutSoFar || " "}
        </pre>
      </div>
    </div>
  );
}
