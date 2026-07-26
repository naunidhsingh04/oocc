export interface LoopScope {
  start: number;
  end: number;
}

/** Playback speed multipliers cycled with `,` / `.` — docs/PRD.md §6.3. */
export const SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const;

/** Steps advanced per second at 1x speed. */
export const BASE_STEPS_PER_SECOND = 24;
