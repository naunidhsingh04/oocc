const STORAGE_KEY = "oocc-tour-seen";

/** docs/PRD.md §9: "skippable and never shown twice." A plain localStorage
 * flag, not app state — the tour's own visibility already lives in
 * `OnboardingTour`'s local component state; this is only the durable
 * record of whether it's ever been dismissed. */
export function hasTourBeenSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage disabled/full — the tour just replays next visit, no worse
    // than not persisting at all.
  }
}
