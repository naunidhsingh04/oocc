import { useCallback, useEffect, useRef, useState } from "react";
import type { VmStep } from "./types";

const STEPS_PER_SECOND = 3;

/**
 * VM-step playback for the compiler explorer. Structurally the same
 * per-instance shape as `lib/curriculum/useEmbeddedTrace.ts` (own
 * `currentStep`/`playing`, own rAF clock) for the same reason that hook
 * isn't `usePlayerStore`: this page needs its own independent playhead
 * over `VmStep[]`, which isn't a `Trace` and can't go through the
 * page-wide singleton or the shared `@oocc/contracts` schema. This is the
 * "adapt VM steps into the same transport interface" seam — everything
 * downstream (the ribbon, the pc indicator, the stack view) reads through
 * `currentStep`/`step` exactly like the main product's player.
 */
export function useCompilerPlayback(steps: readonly VmStep[]) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const lastIndex = Math.max(0, steps.length - 1);

  // Clamping on every render (not in an effect) avoids a stale-then-corrected
  // extra render pass: a shorter `steps` array is reflected in the very same
  // render that receives it, not one tick later. `useState`, not `useRef`,
  // per React's documented "adjusting state when a prop changes" pattern —
  // refs aren't safe to read/write during render.
  const [prevSteps, setPrevSteps] = useState(steps);
  if (prevSteps !== steps) {
    setPrevSteps(steps);
    if (currentStep > lastIndex) setCurrentStep(lastIndex);
    if (playing) setPlaying(false);
  }

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
    if (steps.length === 0) return;
    setPlaying((prev) => {
      if (!prev && currentStep >= lastIndex) setCurrentStep(0);
      return !prev;
    });
  }, [currentStep, lastIndex, steps.length]);

  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();

    function tick(now: number) {
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
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, lastIndex]);

  const step: VmStep | undefined = steps[currentStep];

  return { currentStep, step, playing, jumpTo, stepBy, togglePlay, lastIndex };
}
