"use client";

import type { Trace } from "@oocc/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_STEPS_PER_SECOND,
  buildChannelAssignment,
  type ChannelAssignment,
  computeStepTicks,
  SPEED_STEPS,
  type TickInfo,
} from "@/lib/player";
import { computeEventOccurrences, type EventOccurrences, mapPositionByEvent, mapPositionProportional } from "./eventOccurrences";
import type { CompareEventKind, CompareSyncMode } from "./types";

export interface CompareSide {
  trace: Trace;
  channels: ChannelAssignment;
  ticks: TickInfo[];
  occurrences: EventOccurrences;
  lastIndex: number;
}

export interface UseComparePlaybackResult {
  sideA: CompareSide;
  sideB: CompareSide;
  posA: number;
  posB: number;
  playing: boolean;
  speed: number;
  syncMode: CompareSyncMode;
  eventKind: CompareEventKind;
  setSyncMode: (mode: CompareSyncMode) => void;
  setEventKind: (kind: CompareEventKind) => void;
  /** Scrub side A directly; side B's position is derived via the active sync mode. */
  scrubA: (pos: number) => void;
  /** Scrub side B directly; side A's position is derived via the active sync mode (the inverse mapping). */
  scrubB: (pos: number) => void;
  togglePlay: () => void;
  /** Steps side A by `delta` (side B follows); used by keyboard shortcuts. */
  stepBy: (delta: number) => void;
  setSpeed: (speed: number) => void;
  cycleSpeed: (direction: 1 | -1) => void;
}

function clamp(n: number, max: number): number {
  if (max < 0) return 0;
  return Math.min(Math.max(n, 0), max);
}

function buildSide(trace: Trace): CompareSide {
  const channels = buildChannelAssignment(trace);
  const ticks = computeStepTicks(trace, channels);
  const occurrences = computeEventOccurrences(trace, channels);
  return { trace, channels, ticks, occurrences, lastIndex: Math.max(0, trace.steps.length - 1) };
}

/**
 * Two independent trace playheads on one page, kept in sync — the
 * architecture problem `usePlayerStore` (a page-wide singleton) can't solve
 * (CLAUDE.md's Compare View brief). Modeled after
 * `lib/curriculum/useEmbeddedTrace.ts`'s per-instance-hook precedent, but
 * driving *two* step positions instead of one, and reusing the real
 * rAF + time-accumulator clock algorithm from `lib/player/playbackClock.ts`
 * (never `setInterval`) rather than that hook's simplified fixed-rate timer,
 * since compare view's flagship demo (docs/PRD.md's "sells the product"
 * bubble-sort-vs-quicksort scrub) depends on smooth, jitter-free playback.
 *
 * `posA` is the canonical position while playing or when A is scrubbed;
 * `posB` is always derived from it via the active `CompareSyncMode`.
 * Scrubbing B directly runs the same mapping in reverse so either ribbon
 * can drive the other — "one synchronized scrubber" means the *sync
 * relationship* is single, not that there's literally one shared control.
 */
export function useComparePlayback(traceA: Trace, traceB: Trace): UseComparePlaybackResult {
  const sideA = useMemo(() => buildSide(traceA), [traceA]);
  const sideB = useMemo(() => buildSide(traceB), [traceB]);

  const [posA, setPosA] = useState(0);
  const [posB, setPosB] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [syncMode, setSyncModeState] = useState<CompareSyncMode>("index");
  const [eventKind, setEventKindState] = useState<CompareEventKind>("comparison");

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);

  const mapAtoB = useCallback(
    (pos: number): number => {
      if (syncMode === "index") {
        return clamp(mapPositionProportional(pos, sideA.lastIndex, sideB.lastIndex), sideB.lastIndex);
      }
      const matchesA = sideA.occurrences.get(eventKind) ?? [];
      const matchesB = sideB.occurrences.get(eventKind) ?? [];
      return clamp(mapPositionByEvent(matchesA, matchesB, pos, sideA.lastIndex, sideB.lastIndex), sideB.lastIndex);
    },
    [syncMode, eventKind, sideA, sideB],
  );

  const mapBtoA = useCallback(
    (pos: number): number => {
      if (syncMode === "index") {
        return clamp(mapPositionProportional(pos, sideB.lastIndex, sideA.lastIndex), sideA.lastIndex);
      }
      const matchesB = sideB.occurrences.get(eventKind) ?? [];
      const matchesA = sideA.occurrences.get(eventKind) ?? [];
      return clamp(mapPositionByEvent(matchesB, matchesA, pos, sideB.lastIndex, sideA.lastIndex), sideA.lastIndex);
    },
    [syncMode, eventKind, sideA, sideB],
  );

  // "Adjust state while rendering" (React's own pattern for this, preferred
  // over a setState-in-effect that would cost an extra committed frame):
  // comparing against the previous render's traces/sync inputs and calling
  // setState conditionally, directly in the render body, updates state
  // before this render commits rather than after — no visible stale frame,
  // no `react-hooks/set-state-in-effect` cascading-render warning either.
  const [prevSides, setPrevSides] = useState({ sideA, sideB });
  if (prevSides.sideA !== sideA || prevSides.sideB !== sideB) {
    setPrevSides({ sideA, sideB });
    // A fresh pair of runs resets both playheads to the start rather than
    // carrying over a position that may not even exist in the new trace.
    setPosA(0);
    setPosB(0);
    setPlaying(false);
  }

  const [prevSync, setPrevSync] = useState({ syncMode, eventKind });
  if (prevSync.syncMode !== syncMode || prevSync.eventKind !== eventKind) {
    setPrevSync({ syncMode, eventKind });
    // Changing sync mode or event kind re-derives B from A's current
    // position immediately, so the two ribbons never sit mismatched
    // between a mode change and the next scrub.
    setPosB(mapAtoB(posA));
  }

  const scrubA = useCallback(
    (pos: number) => {
      const next = clamp(pos, sideA.lastIndex);
      setPosA(next);
      setPosB(mapAtoB(next));
      setPlaying(false);
    },
    [sideA.lastIndex, mapAtoB],
  );

  const scrubB = useCallback(
    (pos: number) => {
      const next = clamp(pos, sideB.lastIndex);
      setPosB(next);
      setPosA(mapBtoA(next));
      setPlaying(false);
    },
    [sideB.lastIndex, mapBtoA],
  );

  const stepBy = useCallback(
    (delta: number) => {
      setPosA((prev) => {
        const next = clamp(prev + delta, sideA.lastIndex);
        setPosB(mapAtoB(next));
        return next;
      });
      setPlaying(false);
    },
    [sideA.lastIndex, mapAtoB],
  );

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev;
      if (next && posA >= sideA.lastIndex) {
        setPosA(0);
        setPosB(mapAtoB(0));
      }
      return next;
    });
  }, [posA, sideA.lastIndex, mapAtoB]);

  const setSpeed = useCallback((s: number) => setSpeedState(s), []);
  const cycleSpeed = useCallback((direction: 1 | -1) => {
    setSpeedState((current) => {
      const idx = SPEED_STEPS.findIndex((s) => s === current);
      const base = idx === -1 ? SPEED_STEPS.findIndex((s) => s >= current) : idx;
      const nextIdx = clamp((base === -1 ? 0 : base) + direction, SPEED_STEPS.length - 1);
      return SPEED_STEPS[nextIdx]!;
    });
  }, []);

  const setSyncMode = useCallback((mode: CompareSyncMode) => setSyncModeState(mode), []);
  const setEventKind = useCallback((kind: CompareEventKind) => setEventKindState(kind), []);

  // The real playback clock (docs/PRD.md Phase 1 brief, lib/player/playbackClock.ts):
  // rAF + a time accumulator, never setInterval, so frame-rate jitter never
  // causes step drift. Drives side A forward and re-derives side B from the
  // active sync mode on every advance.
  useEffect(() => {
    if (!playing) return;
    lastTimeRef.current = null;
    accumulatorRef.current = 0;

    function frame(time: number) {
      rafRef.current = requestAnimationFrame(frame);

      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
        return;
      }
      accumulatorRef.current += (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const stepInterval = 1 / (BASE_STEPS_PER_SECOND * speed);
      let advance = 0;
      while (accumulatorRef.current >= stepInterval) {
        accumulatorRef.current -= stepInterval;
        advance += 1;
      }
      if (advance <= 0) return;

      setPosA((prev) => {
        const next = clamp(prev + advance, sideA.lastIndex);
        setPosB(mapAtoB(next));
        if (next >= sideA.lastIndex) setPlaying(false);
        return next;
      });
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, sideA.lastIndex, mapAtoB]);

  return {
    sideA,
    sideB,
    posA,
    posB,
    playing,
    speed,
    syncMode,
    eventKind,
    setSyncMode,
    setEventKind,
    scrubA,
    scrubB,
    togglePlay,
    stepBy,
    setSpeed,
    cycleSpeed,
  };
}
