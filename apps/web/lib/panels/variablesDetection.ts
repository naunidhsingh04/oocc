import type { Trace, Value } from "@oocc/contracts";
import { inlineNumber, valueToDisplay } from "./heapValue";

export interface VariableRow {
  name: string;
  channel: number;
  display: string | number;
  changed: boolean;
  sparkline: number[]; // downsampled numeric history up to the current step, empty if never numeric
}

const SPARKLINE_MAX_POINTS = 40;

/** All locals in the innermost (active) frame at this step — a debugger's
 * "Variables" panel convention. Sparkline history is built once per
 * (trace, name) via a full scan then downsampled, not recomputed by
 * scanning the whole trace on every step. */
export function computeVariableHistories(trace: Trace): Map<string, number[]> {
  const histories = new Map<string, number[]>();
  for (const step of trace.steps) {
    const frame = step.stack[step.stack.length - 1];
    if (!frame) continue;
    for (const [name, value] of Object.entries(frame.locals)) {
      const n = inlineNumber(value);
      if (n === null) continue;
      if (!histories.has(name)) histories.set(name, []);
      histories.get(name)!.push(n);
    }
  }
  for (const [name, values] of histories) {
    histories.set(name, downsample(values, SPARKLINE_MAX_POINTS));
  }
  return histories;
}

function downsample(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const stride = values.length / maxPoints;
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(values[Math.floor(i * stride)]!);
  }
  return out;
}

export function computeVariableRows(
  currentLocals: Record<string, Value> | undefined,
  prevLocals: Record<string, Value> | undefined,
  channels: ReadonlyMap<string, number>,
  histories: ReadonlyMap<string, number[]>,
): VariableRow[] {
  if (!currentLocals) return [];
  return Object.entries(currentLocals)
    .map(([name, value]) => ({
      name,
      channel: channels.get(name) ?? 1,
      display: valueToDisplay(value),
      changed: prevLocals ? JSON.stringify(prevLocals[name] ?? null) !== JSON.stringify(value) : false,
      sparkline: histories.get(name) ?? [],
    }))
    .sort((a, b) => a.channel - b.channel || a.name.localeCompare(b.name));
}
