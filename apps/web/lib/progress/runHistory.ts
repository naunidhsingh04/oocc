import type { Trace } from "@oocc/contracts";
import type { ChannelAssignment, TickCategory, TickInfo } from "@/lib/player";
import { computeStepTicks } from "@/lib/player";

export interface RunHistoryEntry {
  id: string;
  /** The fixture name, problem slug, or article slug this run came from —
   * whatever `loadTrace({ name })` was called with. */
  name: string;
  language: Trace["language"];
  status: Trace["status"];
  stepCount: number;
  timestamp: string;
  /** Downsampled to MAX_STORED_TICKS — see `downsampleTicks`'s docstring
   * for why the full per-step array is never persisted. */
  ticks: TickInfo[];
}

const STORAGE_KEY = "oocc:progress:run-history";
const MAX_ENTRIES = 20;
const MAX_STORED_TICKS = 240;

const PRIORITY: Record<TickCategory, number> = {
  exception: 5,
  call: 4,
  return: 3,
  assignment: 2,
  comparison: 1,
  stdout: 0,
};

/**
 * Shrinks a full per-step tick array down to a fixed-size summary before
 * it's persisted to `localStorage` — the same bucket-and-pick-the-highest-
 * priority-event technique `components/ribbon/tickBins.ts`'s
 * `computeTickBins` uses per-resize for the real ribbon, applied once here
 * at record time instead. A 40k-step trace stored tick-for-tick would blow
 * past reasonable `localStorage` budgets across up to MAX_ENTRIES runs;
 * `MAX_STORED_TICKS` is already more resolution than a small thumbnail
 * ribbon can render anyway.
 */
export function downsampleTicks(ticks: readonly TickInfo[], maxLen = MAX_STORED_TICKS): TickInfo[] {
  if (ticks.length <= maxLen) return [...ticks];

  const out: TickInfo[] = [];
  for (let slot = 0; slot < maxLen; slot += 1) {
    const start = Math.floor((slot / maxLen) * ticks.length);
    const end = Math.min(ticks.length - 1, Math.floor(((slot + 1) / maxLen) * ticks.length) - 1);
    if (end < start) continue;
    let best = ticks[start]!;
    for (let i = start + 1; i <= end; i += 1) {
      const tick = ticks[i]!;
      if (PRIORITY[tick.category] > PRIORITY[best.category]) best = tick;
    }
    out.push(best);
  }
  return out;
}

function readStorage(): RunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RunHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(entries: RunHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/unavailable (private browsing, quota) — run history is
    // a nice-to-have, never something worth surfacing an error over.
  }
}

/** Real recent runs from this browser, most recent first — empty array
 * (not null) when there's genuinely none yet; `RunHistory.tsx` is the one
 * that decides whether to fall back to demo entries. */
export function getRunHistory(): RunHistoryEntry[] {
  return readStorage();
}

/**
 * Appends one real run, deduping consecutive loads of the exact same
 * trace (same name + step count + status) so repeated mounts of the same
 * fixture/problem don't spam the list with identical entries, and caps
 * total entries at MAX_ENTRIES (oldest dropped first).
 */
export function recordRun(params: {
  trace: Trace;
  name: string;
  channels: ChannelAssignment;
  now?: Date;
}): RunHistoryEntry[] {
  const { trace, name, channels } = params;
  const now = params.now ?? new Date();
  const existing = readStorage();

  const last = existing[0];
  const isDuplicateOfLast =
    last !== undefined &&
    last.name === name &&
    last.status === trace.status &&
    last.stepCount === trace.steps.length;
  if (isDuplicateOfLast) return existing;

  const entry: RunHistoryEntry = {
    id: `run_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    language: trace.language,
    status: trace.status,
    stepCount: trace.steps.length,
    timestamp: now.toISOString(),
    ticks: downsampleTicks(computeStepTicks(trace, channels)),
  };

  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeStorage(next);
  return next;
}
