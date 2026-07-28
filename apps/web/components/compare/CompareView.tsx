"use client";

import { useEffect, useState } from "react";
import { fetchFixture, type FixtureBundle, type FixtureName } from "@/lib/fixtures";
import { CompareWorkspace } from "./CompareWorkspace";

// The flagship demo (docs/PRD.md's "this is the demo that sells the
// product"): bubble sort against quicksort's partition step on comparable
// inputs, pre-selected so a first-time visitor sees it without picking
// anything.
const DEFAULT_FIXTURE_A: FixtureName = "bubble_sort";
const DEFAULT_FIXTURE_B: FixtureName = "quicksort_partition";

interface SideState {
  bundle: FixtureBundle | null;
  loading: boolean;
  error: string | null;
}

function useFixtureSide(initial: FixtureName) {
  const [name, setName] = useState<FixtureName>(initial);
  const [state, setState] = useState<SideState>({ bundle: null, loading: true, error: null });

  // "Adjust state while rendering" (React's own pattern — see the identical
  // reasoning in useComparePlayback.ts): flip back to `loading` the instant
  // `name` changes, directly in the render body rather than as the first
  // synchronous call inside the fetch effect below, so there's no
  // `react-hooks/set-state-in-effect` cascading-render warning. The effect
  // itself now only ever calls `setState` from inside its async
  // `fetchFixture` callbacks, which is exactly what effects are for.
  const [prevName, setPrevName] = useState(name);
  if (prevName !== name) {
    setPrevName(name);
    setState((prev) => ({ bundle: prev.bundle, loading: true, error: null }));
  }

  useEffect(() => {
    let cancelled = false;
    fetchFixture(name)
      .then((bundle) => {
        if (!cancelled) setState({ bundle, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState((prev) => ({
            bundle: prev.bundle,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load fixture",
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return { name, setName, ...state };
}

/**
 * Loads the two fixtures Compare View needs and hands them to
 * `CompareWorkspace` once both are ready — mirrors
 * `components/workspace/FixturePicker.tsx` / `lib/fixtures.ts`'s dev-only
 * fixture transport, just fetched independently per side instead of into a
 * single global store. Reserves the full-height layout while loading (no
 * layout shift, docs/PRD.md §9) rather than collapsing to nothing.
 */
export function CompareView() {
  const a = useFixtureSide(DEFAULT_FIXTURE_A);
  const b = useFixtureSide(DEFAULT_FIXTURE_B);

  if (a.error || b.error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p role="alert" className="font-mono-label text-[12px] uppercase tracking-[0.06em] text-mutate">
          {a.error ?? b.error}
        </p>
      </div>
    );
  }

  if (!a.bundle || !b.bundle) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-label="Loading compare view">
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 animate-pulse border-r border-rule bg-panel" />
          <div className="min-h-0 flex-1 animate-pulse bg-panel" />
        </div>
        <div className="h-9 shrink-0 border-t border-rule bg-panel" />
      </div>
    );
  }

  return (
    <CompareWorkspace
      bundleA={a.bundle}
      bundleB={b.bundle}
      loadingA={a.loading}
      loadingB={b.loading}
      onFixtureChangeA={a.setName}
      onFixtureChangeB={b.setName}
    />
  );
}
