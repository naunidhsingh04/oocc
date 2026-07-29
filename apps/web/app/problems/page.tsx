"use client";

import { FacetRail } from "@/components/problems/FacetRail";
import { ProblemTable } from "@/components/problems/ProblemTable";
import { allTags, applyListState, DEFAULT_LIST_STATE, parseListState, serializeListState } from "@/lib/problems/listState";
import { PROBLEMS } from "@/lib/problems/data";
import { Stagger, StaggerItem } from "@oocc/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

/**
 * `/problems` — the data table (docs/PRD.md Phase 4 frontend brief).
 * Filter/sort state lives in the URL (`useSearchParams`/`router.replace`),
 * not component state, so a reload, share, or back-button press all
 * reproduce the exact same view. `useSearchParams` requires a Suspense
 * boundary in the App Router (Next.js opts every reader of it into
 * client-side-only rendering at the boundary) — the default export below
 * is just that wrapper.
 */
export default function ProblemsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-0 flex-1" />}>
      <ProblemsPageInner />
    </Suspense>
  );
}

function ProblemsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(() => parseListState(searchParams), [searchParams]);

  const tags = useMemo(() => allTags(PROBLEMS), []);
  const filtered = useMemo(() => applyListState(PROBLEMS, state), [state]);

  function updateState(next: typeof state) {
    const qs = serializeListState(next);
    router.replace(qs ? `/problems?${qs}` : "/problems", { scroll: false });
  }

  return (
    <Stagger className="flex min-h-0 flex-1 flex-col">
      <StaggerItem className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-4 py-3">
        <h1 className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink">Problems</h1>
        <input
          type="search"
          value={state.q}
          onChange={(e) => updateState({ ...state, q: e.target.value })}
          placeholder="Search title or tag…"
          className="h-8 w-64 rounded-control border border-rule bg-paper px-2.5 font-body text-[13px] text-ink outline-none transition-colors duration-150 focus:border-signal"
        />
        {(state.difficulty.length > 0 || state.status.length > 0 || state.tags.length > 0 || state.q) && (
          <button
            type="button"
            onClick={() => updateState(DEFAULT_LIST_STATE)}
            className="font-body text-[13px] font-medium text-ink-soft transition-colors duration-150 hover:text-signal"
          >
            Clear filters
          </button>
        )}
      </StaggerItem>
      <StaggerItem className="flex min-h-0 flex-1">
        <FacetRail
          state={state}
          onChange={updateState}
          tags={tags}
          counts={{ total: PROBLEMS.length, filtered: filtered.length }}
        />
        <ProblemTable
          problems={filtered}
          sort={state.sort}
          dir={state.dir}
          onSortChange={(sort, dir) => updateState({ ...state, sort, dir })}
        />
      </StaggerItem>
    </Stagger>
  );
}
