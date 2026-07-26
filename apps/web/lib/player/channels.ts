import type { Trace } from "@oocc/contracts";

/** docs/PRD.md §6.2: eight channel colors, reused round-robin past that. */
export const CHANNEL_COUNT = 8;

export type ChannelAssignment = ReadonlyMap<string, number>;

/**
 * Assigns every local variable name a stable channel (1-8) for the whole
 * run, in first-appearance order across `trace.steps`. Same name, same
 * channel everywhere — the editor gutter, the variables panel, array-bar
 * pointers, and the ribbon all import this one module instead of deriving
 * their own assignment, so a variable can't drift to a different color in
 * one panel than another.
 */
export function buildChannelAssignment(trace: Trace): ChannelAssignment {
  const assignment = new Map<string, number>();
  let next = 0;

  for (const step of trace.steps) {
    for (const frame of step.stack) {
      for (const name of Object.keys(frame.locals)) {
        if (assignment.has(name)) continue;
        assignment.set(name, (next % CHANNEL_COUNT) + 1);
        next += 1;
      }
    }
  }

  return assignment;
}

export function channelColorVar(channel: number): string {
  return `var(--color-ch-${channel})`;
}
