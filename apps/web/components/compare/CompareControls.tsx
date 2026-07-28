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
import { COMPARE_EVENT_KINDS, type CompareEventKind, type CompareSyncMode } from "@/lib/compare/types";

export interface CompareControlsProps {
  playing: boolean;
  speed: number;
  syncMode: CompareSyncMode;
  eventKind: CompareEventKind;
  onSetSyncMode: (mode: CompareSyncMode) => void;
  onSetEventKind: (kind: CompareEventKind) => void;
  onTogglePlay: () => void;
  onStepBy: (delta: number) => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onCycleSpeed: (direction: 1 | -1) => void;
}

/**
 * The shared transport + sync-mode bar for Compare View — one control
 * surface driving both playheads (docs/PRD.md's "one synchronized
 * scrubber"), styled like the main workspace's `PlaybackBar`.
 */
export function CompareControls({
  playing,
  speed,
  syncMode,
  eventKind,
  onSetSyncMode,
  onSetEventKind,
  onTogglePlay,
  onStepBy,
  onJumpToStart,
  onJumpToEnd,
  onCycleSpeed,
}: CompareControlsProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-t border-rule bg-panel px-2">
      <IconButton aria-label="Jump both to start" onClick={onJumpToStart}>
        <SkipToStartIcon />
      </IconButton>
      <IconButton aria-label="Step both back" onClick={() => onStepBy(-1)}>
        <StepBackIcon />
      </IconButton>
      <IconButton aria-label={playing ? "Pause" : "Play"} onClick={onTogglePlay} active={playing}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
      <IconButton aria-label="Step both forward" onClick={() => onStepBy(1)}>
        <StepForwardIcon />
      </IconButton>
      <IconButton aria-label="Jump both to end" onClick={onJumpToEnd}>
        <SkipToEndIcon />
      </IconButton>

      <div className="h-4 w-px bg-rule" />

      <button
        type="button"
        className="rounded-control px-1.5 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:bg-paper hover:text-ink"
        onClick={() => onCycleSpeed(-1)}
        aria-label="Slower"
      >
        ,
      </button>
      <span className="w-10 text-center font-mono-label text-[11px] tabular-nums text-ink-soft">{speed}×</span>
      <button
        type="button"
        className="rounded-control px-1.5 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:bg-paper hover:text-ink"
        onClick={() => onCycleSpeed(1)}
        aria-label="Faster"
      >
        .
      </button>

      <div className="h-4 w-px bg-rule" />

      <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">Sync</span>
      <div className="flex items-center rounded-control border border-rule p-0.5">
        <button
          type="button"
          data-active={syncMode === "index" || undefined}
          onClick={() => onSetSyncMode("index")}
          className="rounded-control px-2 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft data-[active]:bg-signal data-[active]:text-white"
          aria-pressed={syncMode === "index"}
        >
          Step %
        </button>
        <button
          type="button"
          data-active={syncMode === "event" || undefined}
          onClick={() => onSetSyncMode("event")}
          className="rounded-control px-2 py-0.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft data-[active]:bg-signal data-[active]:text-white"
          aria-pressed={syncMode === "event"}
        >
          Event
        </button>
      </div>

      {syncMode === "event" ? (
        <select
          aria-label="Event kind to sync by"
          value={eventKind}
          onChange={(e) => onSetEventKind(e.target.value as CompareEventKind)}
          className="h-6 rounded-control border border-rule bg-panel px-1.5 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink"
        >
          {COMPARE_EVENT_KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
