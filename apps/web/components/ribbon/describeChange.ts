import type { Step } from "@oocc/contracts";

const LOCAL_PATH = /^f\d+\.([A-Za-z_][A-Za-z0-9_]*)$/;

function formatValue(value: unknown): string {
  if (value === null || typeof value !== "object") return String(value);
  if ("val" in value) return "repr" in value && typeof value.repr === "string" ? value.repr : JSON.stringify(value.val);
  if ("ref" in value) return String(value.ref);
  return "";
}

/** A short "what changed" string for the ribbon's hover tooltip. */
export function describeChange(step: Step | undefined): string {
  if (!step) return "";
  if (step.changed.length === 0) return "";

  const path = step.changed[0]!;
  const localMatch = LOCAL_PATH.exec(path);
  if (localMatch) {
    const name = localMatch[1]!;
    for (const frame of step.stack) {
      if (name in frame.locals) {
        return `${name} = ${formatValue(frame.locals[name])}`;
      }
    }
    return name;
  }

  return path;
}
