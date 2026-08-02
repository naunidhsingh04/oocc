"use client";

import { FacetRail } from "@/components/problems/FacetRail";
import { ProblemTable } from "@/components/problems/ProblemTable";
import { allTags, applyListState, DEFAULT_LIST_STATE, parseListState, serializeListState } from "@/lib/problems/listState";
import { PROBLEMS } from "@/lib/problems/data";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Stagger, StaggerItem } from "@oocc/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

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
  // Below `md`, `FacetRail`'s fixed `w-48` (192px) left barely half of a
  // 375px screen for the table, clipping the Tags/Acceptance columns
  // entirely out of the visible area (found live) — collapsed here into a
  // toggleable full-width panel instead, so the table gets the full
  // width by default and filtering is still reachable, just not always-on.
  const isNarrow = useMediaQuery("(max-width: 767px)");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const tags = useMemo(() => allTags(PROBLEMS), []);
  const filtered = useMemo(() => applyListState(PROBLEMS, state), [state]);
  const activeFilterCount = state.difficulty.length + state.status.length + state.tags.length + (state.q ? 1 : 0);

  function updateState(next: typeof state) {
    const qs = serializeListState(next);
    router.replace(qs ? `/problems?${qs}` : "/problems", { scroll: false });
  }

  return (
    <Stagger className="flex min-h-0 flex-1 flex-col">
      <StaggerItem className="flex shrink-0 flex-wrap items-center gap-3 border-b border-rule bg-panel px-4 py-3">
        <h1 className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink">Problems</h1>
        {isNarrow ? (
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className="flex min-h-11 items-center gap-1.5 rounded-control border border-rule px-3 font-body text-[13px] font-medium text-ink"
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        ) : (
          <input
            type="search"
            value={state.q}
            onChange={(e) => updateState({ ...state, q: e.target.value })}
            placeholder="Search title or tag…"
            className="h-8 w-64 rounded-control border border-rule bg-paper px-2.5 font-body text-[13px] text-ink outline-none transition-colors duration-150 focus:border-signal"
          />
        )}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => updateState(DEFAULT_LIST_STATE)}
            className="font-body text-[13px] font-medium text-ink-soft transition-colors duration-150 hover:text-signal"
          >
            Clear filters
          </button>
        )}
      </StaggerItem>
      {isNarrow && filtersOpen ? (
        <StaggerItem className="shrink-0 border-b border-rule">
          <input
            type="search"
            value={state.q}
            onChange={(e) => updateState({ ...state, q: e.target.value })}
            placeholder="Search title or tag…"
            className="h-11 w-full border-b border-rule bg-paper px-3 font-body text-[13px] text-ink outline-none focus:border-signal"
          />
          <FacetRail
            state={state}
            onChange={updateState}
            tags={tags}
            counts={{ total: PROBLEMS.length, filtered: filtered.length }}
            className="w-full max-h-[50vh] border-r-0"
          />
        </StaggerItem>
      ) : null}
      <StaggerItem className="flex min-h-0 flex-1">
        {isNarrow ? null : (
          <FacetRail
            state={state}
            onChange={updateState}
            tags={tags}
            counts={{ total: PROBLEMS.length, filtered: filtered.length }}
          />
        )}
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
