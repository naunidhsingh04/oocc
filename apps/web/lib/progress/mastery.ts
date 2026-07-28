/**
 * Mastery -> visual-fill mapping for the concept graph (brief item 1:
 * "mastery encoded in fill strength ... not color-coding-only"). Pure and
 * unit tested directly, matching this repo's house style for every other
 * deterministic mapping (`apps/api/app/progress/mastery.py`'s own
 * docstring makes the same "pure functions, unit tested directly" point
 * about the score itself; this is the same discipline applied to how the
 * score is drawn).
 */

const MIN_FILL = 0.06; // an untouched concept still renders as a visible ring, not nothing

export function clampMastery(mastery: number): number {
  if (Number.isNaN(mastery)) return 0;
  return Math.min(1, Math.max(0, mastery));
}

/** Fraction (0-1) of the node's height that should render as "filled" —
 * a floor above zero so an unattempted concept still reads as a real,
 * present node (an empty outline) rather than invisible. */
export function masteryFillRatio(mastery: number): number {
  const clamped = clampMastery(mastery);
  return MIN_FILL + clamped * (1 - MIN_FILL);
}

/** Whole-percent label for the small mono readout beside each node —
 * the one number this view keeps, because it's the exact thing that
 * decides whether a learner treats a concept as solid or shaky. */
export function masteryPercentLabel(mastery: number): string {
  return `${Math.round(clampMastery(mastery) * 100)}%`;
}

export const WEAK_MASTERY_THRESHOLD = 0.5;

export function isWeakConcept(mastery: number): boolean {
  return clampMastery(mastery) < WEAK_MASTERY_THRESHOLD;
}
