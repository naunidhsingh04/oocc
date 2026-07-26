import type { Trace } from "@oocc/contracts";

export interface ConsoleLine {
  stepIndex: number;
  text: string;
}

/** Every stdout_delta, split into printed lines and tagged with the step
 * that produced it — computed once per trace, filtered by the current
 * step at render time so scrubbing back in time hides not-yet-printed
 * output, exactly as a real run would look mid-execution. */
export function computeConsoleLines(trace: Trace): ConsoleLine[] {
  const lines: ConsoleLine[] = [];
  let carry = "";
  for (const step of trace.steps) {
    if (!step.stdout_delta) continue;
    carry += step.stdout_delta;
    const parts = carry.split("\n");
    carry = parts.pop() ?? "";
    for (const text of parts) lines.push({ stepIndex: step.i, text });
  }
  if (carry) lines.push({ stepIndex: trace.steps[trace.steps.length - 1]?.i ?? 0, text: carry });
  return lines;
}
