"use client";

import { describeStepForAnnouncement, usePlayerStore } from "@/lib/player";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 300;

/**
 * docs/PRD.md §9: "the current step announces as 'Step 412, line 17, mid
 * changed to 4' via a polite live region." Debounced rather than updated on
 * every frame — playback can advance many steps a second at higher speeds,
 * and a screen reader re-announcing that fast is noise, not signal; the
 * region settles on whatever step the user is actually looking at once
 * playback pauses or scrubbing slows down.
 */
export function StepAnnouncer() {
  const trace = usePlayerStore((state) => state.trace);
  const currentStep = usePlayerStore((state) => state.currentStep);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!trace) return;
    const id = setTimeout(() => {
      setAnnouncement(describeStepForAnnouncement(trace.steps[currentStep], currentStep));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trace, currentStep]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
