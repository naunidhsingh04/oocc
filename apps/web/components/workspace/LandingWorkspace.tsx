"use client";

import { useEffect, useRef } from "react";
import { fetchFixture } from "@/lib/fixtures";
import { usePlayerStore } from "@/lib/player";
import { Workspace } from "./Workspace";

const LANDING_FIXTURE = "bubble_sort";

/**
 * `/`'s landing treatment (docs/PRD.md Phase 6 frontend brief): "above the
 * fold is a real workspace with a real trace already playing — the
 * component itself, not a screenshot, not a video." No separate marketing
 * hero exists or is added here — the running workspace *is* the pitch,
 * per PRD §6.1's "no chrome that isn't carrying information." This wrapper
 * only adds two things Workspace itself doesn't do on its own: load a
 * fixture and start playback the moment nothing else is loaded, and loop
 * back to the start when playback reaches the end instead of just
 * stopping — a first-time visitor who doesn't touch anything still sees
 * continuous motion, not a demo that plays once and goes static.
 *
 * Deliberately does nothing if a trace is already loaded (e.g. a user
 * navigated here after loading something else via the command palette) —
 * this is a first-visit affordance, never a hijack of in-progress work.
 *
 * Real bug found building this: the natural instinct is a `cancelled`
 * flag set in the effect's cleanup, to avoid acting on a stale fetch after
 * unmount — but this only ever mutates the external zustand store, not
 * React state, so there's no "setState after unmount" warning to guard
 * against in the first place. With it, React 19's dev-mode Strict Mode
 * double-invoke (mount -> cleanup -> mount) cancelled the *first*
 * invocation's in-flight fetch, and a `hasAttempted` ref meant to prevent
 * a duplicate request then blocked the second invocation from ever
 * retrying — net result, no fetch ever completed and the landing page
 * silently stayed on "no fixture loaded." Fixed by dropping both guards:
 * the effect just checks the store's own `trace` at resolve time, which
 * is correct whether it runs once or twice.
 */
export function LandingWorkspace() {
  const hasTrace = usePlayerStore((state) => state.trace !== null);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const playing = usePlayerStore((state) => state.playing);
  const lastIndex = usePlayerStore((state) => (state.trace ? state.trace.steps.length - 1 : 0));
  const userInteracted = useRef(false);

  // Once a visitor touches anything (click, keypress, scrub), the
  // auto-loop below stops — this is a first-visit demo affordance, never
  // a hijack of a user who paused deliberately to look at something.
  useEffect(() => {
    const markInteracted = () => {
      userInteracted.current = true;
    };
    window.addEventListener("pointerdown", markInteracted, { capture: true });
    window.addEventListener("keydown", markInteracted, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", markInteracted, { capture: true });
      window.removeEventListener("keydown", markInteracted, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (hasTrace) return;
    fetchFixture(LANDING_FIXTURE)
      .then((bundle) => {
        // Re-check at resolve time, not effect-start time: if something
        // else loaded a trace while this was in flight (or this effect
        // ran twice), don't stomp on it.
        if (usePlayerStore.getState().trace !== null) return;
        usePlayerStore.getState().loadTrace(bundle);
        usePlayerStore.getState().play();
      })
      .catch(() => {
        // Best-effort demo affordance — if the dev-only fixture route is
        // unreachable (e.g. production, where it 404s by design), the
        // workspace just renders its normal empty state. Never a crash.
      });
  }, [hasTrace]);

  useEffect(() => {
    if (!hasTrace || playing || currentStep < lastIndex || lastIndex <= 0) return;
    if (userInteracted.current) return;
    // Reached the end on its own (not paused by a user mid-scrub) — loop.
    const id = setTimeout(() => {
      usePlayerStore.getState().jumpToStart();
      usePlayerStore.getState().play();
    }, 1200);
    return () => clearTimeout(id);
  }, [hasTrace, playing, currentStep, lastIndex]);

  return <Workspace />;
}
