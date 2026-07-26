import { useEffect } from "react";
import { usePlayerStore } from "./store";
import { BASE_STEPS_PER_SECOND } from "./types";

/**
 * Drives playback off requestAnimationFrame with a time accumulator, never
 * setInterval (docs/PRD.md Phase 1 brief) — frame-rate jitter never causes
 * step drift because leftover time always carries into the next frame
 * rather than being discarded. Mount this once near the workspace root.
 */
export function usePlaybackClock(): void {
  useEffect(() => {
    let rafId = 0;
    let lastTime: number | null = null;
    let accumulator = 0;

    function frame(time: number) {
      rafId = requestAnimationFrame(frame);
      const { playing, speed, trace, advanceBy } = usePlayerStore.getState();

      if (!playing || !trace) {
        lastTime = null;
        accumulator = 0;
        return;
      }

      if (lastTime === null) {
        lastTime = time;
        return;
      }

      accumulator += (time - lastTime) / 1000;
      lastTime = time;

      const stepInterval = 1 / (BASE_STEPS_PER_SECOND * speed);
      let stepsToAdvance = 0;
      while (accumulator >= stepInterval) {
        accumulator -= stepInterval;
        stepsToAdvance += 1;
      }

      if (stepsToAdvance > 0) advanceBy(stepsToAdvance);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
