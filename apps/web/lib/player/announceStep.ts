import type { Step } from "@oocc/contracts";

const LOCAL_PATH = /^f\d+\.([A-Za-z_][A-Za-z0-9_]*)$/;

function formatValue(value: unknown): string {
  if (value === null || typeof value !== "object") return String(value);
  if ("val" in value) {
    return "repr" in value && typeof value.repr === "string" ? value.repr : JSON.stringify(value.val);
  }
  if ("ref" in value) return String(value.ref);
  return "";
}

/**
 * The screen-reader announcement text for one step (docs/PRD.md §9: "the
 * current step announces as 'Step 412, line 17, mid changed to 4' via a
 * polite live region"). `stepNumber` is the array position shown by the
 * visible step counter (`PlaybackBar.tsx`), not `step.i` — the two differ
 * for a head/tail-truncated trace, and this always matches what's on
 * screen so a sighted-and-hearing user cross-checking the two never gets
 * two different numbers for "the current step."
 */
export function describeStepForAnnouncement(step: Step | undefined, stepNumber: number): string {
  if (!step) return "";

  const base = `Step ${stepNumber}, line ${step.line}`;
  const path = step.changed[0];
  if (!path) return `${base}.`;

  const localMatch = LOCAL_PATH.exec(path);
  if (localMatch) {
    const name = localMatch[1]!;
    for (const frame of step.stack) {
      if (name in frame.locals) {
        return `${base}, ${name} changed to ${formatValue(frame.locals[name])}.`;
      }
    }
  }

  if (step.event === "call") return `${base}, entered ${step.func}.`;
  if (step.event === "return") return `${base}, returned from ${step.func}.`;
  if (step.event === "exception") return `${base}, exception raised.`;

  return `${base}.`;
}
