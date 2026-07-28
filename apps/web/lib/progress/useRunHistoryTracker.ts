"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/lib/player";
import { recordRun } from "./runHistory";

/**
 * Run history, option (b) from the phase brief: track genuinely real runs
 * made in this browser (rather than treating run history as demo-only data
 * like problems/curriculum) by watching the global player store for new
 * trace loads and appending each one to `localStorage`
 * (`lib/progress/runHistory.ts`). Mounted once, globally, from
 * `AppShell.tsx` — deliberately *not* wired into `Workspace.tsx` or
 * `ProblemWorkspace.tsx` directly: both already funnel every trace load
 * (fixture picker, problem "Run", curriculum "Expand to workspace") through
 * this one shared `usePlayerStore.loadTrace` action, so subscribing to the
 * store from outside is a narrow, one-file hook instead of a change spread
 * across every place a trace gets loaded.
 */
export function useRunHistoryTracker(): void {
  useEffect(() => {
    let lastSourceHash: string | null = null;

    const unsubscribe = usePlayerStore.subscribe((state) => {
      const trace = state.trace;
      if (!trace) return;
      if (trace.source_hash === lastSourceHash) return;
      lastSourceHash = trace.source_hash;
      recordRun({
        trace,
        name: state.fixtureName ?? trace.source_hash.slice(0, 12),
        channels: state.channels,
      });
    });

    // Cover the trace already loaded before this effect ran (e.g. a
    // client-side navigation that mounted AppShell after Workspace had
    // already called loadTrace once).
    const initial = usePlayerStore.getState();
    if (initial.trace) {
      lastSourceHash = initial.trace.source_hash;
    }

    return unsubscribe;
  }, []);
}
