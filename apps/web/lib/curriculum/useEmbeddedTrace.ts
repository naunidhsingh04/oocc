"use client";

import type { Trace } from "@oocc/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildChannelAssignment } from "@/lib/player/channels";
import { computeStepTicks } from "@/lib/player/ticks";

const STEPS_PER_SECOND = 3;

/**
 * A self-contained, per-instance playback state for one embedded trace
 * inside a curriculum article (docs/PRD.md §6.5) — deliberately NOT
 * `usePlayerStore`, which is a page-wide singleton: an article can embed
 * many live traces on one page (one per code block), each needing its own
 * independent step position, so this hook is instantiated once per
 * `<EmbeddedTrace>` instead of sharing global state. It reuses the exact
 * same pure computation utilities the main workspace's player store does
 * (`buildChannelAssignment`, `computeStepTicks`) so an embedded trace's
 * channel colors and ribbon ticks are pixel-identical to the same trace
 * opened in the full workspace — only the playback state itself is local.
 */
export function useEmbeddedTrace(trace: Trace) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const channels = useMemo(() => buildChannelAssignment(trace), [trace]);
  const ticks = useMemo(() => computeStepTicks(trace, channels), [trace, channels]);
  const lastIndex = trace.steps.length - 1;

  const jumpTo = useCallback(
    (index: number) => {
      setCurrentStep(Math.min(Math.max(index, 0), lastIndex));
      setPlaying(false);
    },
    [lastIndex],
  );

  const stepBy = useCallback(
    (delta: number) => {
      setCurrentStep((prev) => Math.min(Math.max(prev + delta, 0), lastIndex));
      setPlaying(false);
    },
    [lastIndex],
  );

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      if (!prev && currentStep >= lastIndex) setCurrentStep(0);
      return !prev;
    });
  }, [currentStep, lastIndex]);

  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= 1000 / STEPS_PER_SECOND) {
        lastTickRef.current = now;
        setCurrentStep((prev) => {
          if (prev >= lastIndex) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, lastIndex]);

  const step = trace.steps[currentStep];

  return { currentStep, step, playing, channels, ticks, jumpTo, stepBy, togglePlay, lastIndex };
}
