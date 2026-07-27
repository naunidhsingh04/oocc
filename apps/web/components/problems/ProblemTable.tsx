"use client";

import type { Problem } from "@/lib/problems/types";
import type { SortColumn, SortDirection } from "@/lib/problems/listState";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@oocc/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DifficultyChip } from "./DifficultyChip";
import { StatusGlyph } from "./StatusGlyph";

const ROW_HEIGHT = 26;

interface Column {
  key: SortColumn | "tags";
  label: string;
  sortable: boolean;
  className: string;
}

const COLUMNS: Column[] = [
  { key: "status", label: "", sortable: true, className: "w-8" },
  { key: "title", label: "Title", sortable: true, className: "flex-1 min-w-0" },
  { key: "difficulty", label: "Difficulty", sortable: true, className: "w-24 shrink-0" },
  { key: "tags", label: "Tags", sortable: false, className: "w-64 shrink-0" },
  { key: "acceptance", label: "Acceptance", sortable: true, className: "w-24 shrink-0 text-right" },
];

export interface ProblemTableProps {
  problems: Problem[];
  sort: SortColumn;
  dir: SortDirection;
  onSortChange: (sort: SortColumn, dir: SortDirection) => void;
}

/**
 * A real data table (docs/PRD.md Phase 4 frontend brief), not cards:
 * dense (26px rows -> ~40 visible on a 1080p viewport under the chrome),
 * virtualized via `@tanstack/react-virtual` (only the visible row window
 * is ever mounted — matters once this scales past the 12-problem seed
 * set), sortable columns, and `j`/`k`/arrow-key row navigation with
 * `Enter` to open, mirroring LeetCode's keyboard-first posture without
 * its 12px cramping.
 */
export function ProblemTable({ problems, sort, dir, onSortChange }: ProblemTableProps) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const virtualizer = useVirtualizer({
    count: problems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  useEffect(() => {
    if (focusedIndex >= problems.length) setFocusedIndex(Math.max(0, problems.length - 1));
  }, [problems.length, focusedIndex]);

  const openRow = useCallback(
    (index: number) => {
      const problem = problems[index];
      if (problem) router.push(`/problems/${problem.slug}`);
    },
    [problems, router],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (problems.length === 0) return;
      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          setFocusedIndex((i) => {
            const next = Math.min(i + 1, problems.length - 1);
            virtualizer.scrollToIndex(next, { align: "auto" });
            return next;
          });
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          setFocusedIndex((i) => {
            const next = Math.max(i - 1, 0);
            virtualizer.scrollToIndex(next, { align: "auto" });
            return next;
          });
          break;
        case "Enter":
          event.preventDefault();
          openRow(focusedIndex);
          break;
        default:
          break;
      }
    },
    [problems.length, focusedIndex, openRow, virtualizer],
  );

  function handleHeaderClick(column: Column) {
    if (!column.sortable) return;
    const key = column.key as SortColumn;
    if (sort === key) {
      onSortChange(key, dir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(key, "asc");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b border-rule bg-panel px-2">
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            onClick={() => handleHeaderClick(column)}
            className={cn(
              "flex items-center gap-1 px-1.5 py-1.5 text-left font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft",
              column.className,
              column.sortable && "cursor-pointer hover:text-ink",
            )}
            disabled={!column.sortable}
          >
            {column.label}
            {column.sortable && sort === column.key ? (
              <span className="text-signal">{dir === "asc" ? "▲" : "▼"}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-auto outline-none"
        tabIndex={0}
        role="grid"
        aria-label="Problem list"
        aria-rowcount={problems.length}
        onKeyDown={handleKeyDown}
      >
        {problems.length === 0 ? (
          <div className="p-6 text-center font-body text-[13px] text-ink-soft">
            No problems match the current filters.
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const problem = problems[virtualRow.index]!;
              const isFocused = virtualRow.index === focusedIndex;
              return (
                <div
                  key={problem.slug}
                  role="row"
                  aria-rowindex={virtualRow.index + 1}
                  data-testid={`problem-row-${problem.slug}`}
                  className={cn(
                    "absolute left-0 top-0 flex w-full cursor-pointer items-center border-b border-rule px-2 font-body text-[13px] text-ink hover:bg-paper",
                    isFocused && "bg-paper ring-1 ring-inset ring-signal",
                  )}
                  style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                  onClick={() => {
                    setFocusedIndex(virtualRow.index);
                    openRow(virtualRow.index);
                  }}
                  onMouseEnter={() => setFocusedIndex(virtualRow.index)}
                >
                  <div className="flex w-8 items-center justify-center">
                    <StatusGlyph status={problem.status} />
                  </div>
                  <div className="min-w-0 flex-1 truncate pr-2">{problem.title}</div>
                  <div className="w-24 shrink-0">
                    <DifficultyChip difficulty={problem.difficulty} />
                  </div>
                  <div className="w-64 shrink-0 truncate font-mono-label text-[11px] uppercase tracking-[0.04em] text-ink-soft">
                    {problem.tags.join(" · ")}
                  </div>
                  <div className="w-24 shrink-0 text-right font-mono-label text-[11px] text-ink-soft">
                    {problem.acceptance}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
