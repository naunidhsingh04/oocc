export interface LoopScope {
  start: number;
  end: number;
}

/** Playback speed multipliers cycled with `,` / `.` — docs/PRD.md §6.3. */
export const SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const;

/**
 * Steps advanced per second at 1x speed. Was 24 — fast enough that
 * following a single comparison or swap by eye was impossible even with
 * the clearer per-step visualization treatment (`ArrayPanel.tsx`); ~2/s is
 * slow enough to read a step's caption before the next one lands, with the
 * existing `,`/`.` speed control (`SPEED_STEPS`) still available for
 * someone who wants faster playback once they know what they're looking
 * for.
 */
export const BASE_STEPS_PER_SECOND = 2;
