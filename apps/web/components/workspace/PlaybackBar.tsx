"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import {
  IconButton,
  PauseIcon,
  PlayIcon,
  SkipToEndIcon,
  SkipToStartIcon,
  StepBackIcon,
  StepForwardIcon,
} from "@oocc/ui";

/**
 * Sits alongside the trace ribbon (docs/PRD.md §6.4: "step 412/1840  ◂ ▸
 * ⏵ 1×"). Every control here is a thin wrapper over a player-store action —
 * the ribbon itself owns scrubbing and loop-bracket clicks.
 */
export function PlaybackBar() {
  const trace = usePlayerStore((state) => state.trace);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const playing = usePlayerStore((state) => state.playing);
  const speed = usePlayerStore((state) => state.speed);
  const loopScope = usePlayerStore((state) => state.loopScope);
  const line = usePlayerStore((state) => getStateAt(state.trace, state.currentStep)?.line);

  const stepCount = trace?.steps.length ?? 0;
  const disabled = stepCount === 0;

  const {
    jumpToStart,
    jumpToEnd,
    stepBackward,
    stepForward,
    togglePlay,
    cycleSpeed,
    setLoopScope,
  } = usePlayerStore.getState();

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-t border-rule bg-panel px-2">
      <IconButton aria-label="Jump to start" disabled={disabled} onClick={jumpToStart}>
        <SkipToStartIcon />
      </IconButton>
      <IconButton aria-label="Step backward" disabled={disabled} onClick={stepBackward}>
        <StepBackIcon />
      </IconButton>
      <IconButton aria-label={playing ? "Pause" : "Play"} disabled={disabled} onClick={togglePlay} active={playing}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
      <IconButton aria-label="Step forward" disabled={disabled} onClick={stepForward}>
        <StepForwardIcon />
      </IconButton>
      <IconButton aria-label="Jump to end" disabled={disabled} onClick={jumpToEnd}>
        <SkipToEndIcon />
      </IconButton>

      <div className="mx-1 h-4 w-px bg-rule" />

      <button
        type="button"
        className="rounded-control px-1.5 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        onClick={() => cycleSpeed(-1)}
        aria-label="Slower"
      >
        ,
      </button>
      <span className="w-10 text-center font-mono-label text-[11px] tabular-nums text-ink-soft">{speed}×</span>
      <button
        type="button"
        className="rounded-control px-1.5 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        onClick={() => cycleSpeed(1)}
        aria-label="Faster"
      >
        .
      </button>

      <div className="mx-1 h-4 w-px bg-rule" />

      <span className="font-mono-label text-[11px] tabular-nums text-ink-soft">
        step {stepCount === 0 ? 0 : currentStep} / {Math.max(0, stepCount - 1)}
        {line !== undefined ? ` · line ${line}` : ""}
      </span>

      {loopScope ? (
        <>
          <div className="mx-1 h-4 w-px bg-rule" />
          <button
            type="button"
            className="rounded-control border border-signal px-1.5 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-signal"
            onClick={() => setLoopScope(null)}
          >
            loop {loopScope.start}–{loopScope.end} ×
          </button>
        </>
      ) : null}
    </div>
  );
}
