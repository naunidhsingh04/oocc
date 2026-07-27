import type { Difficulty, Problem, ProblemStatus } from "./types";

export type SortColumn = "status" | "title" | "difficulty" | "acceptance";
export type SortDirection = "asc" | "desc";

export interface ProblemListState {
  q: string;
  difficulty: Difficulty[];
  tags: string[];
  status: ProblemStatus[];
  sort: SortColumn;
  dir: SortDirection;
}

export const DEFAULT_LIST_STATE: ProblemListState = {
  q: "",
  difficulty: [],
  tags: [],
  status: [],
  sort: "title",
  dir: "asc",
};

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Parses the URL-synced filter/sort state from `URLSearchParams` — the
 * whole point (per the phase brief: "filter state in the URL") is that
 * this state survives a reload/share/back-button, so every reader of it
 * goes through here rather than component-local state. */
export function parseListState(params: URLSearchParams): ProblemListState {
  const sort = params.get("sort");
  const dir = params.get("dir");
  return {
    q: params.get("q") ?? "",
    difficulty: (params.get("difficulty")?.split(",").filter(Boolean) ?? []) as Difficulty[],
    tags: params.get("tags")?.split(",").filter(Boolean) ?? [],
    status: (params.get("status")?.split(",").filter(Boolean) ?? []) as ProblemStatus[],
    sort: (sort === "status" || sort === "difficulty" || sort === "acceptance" ? sort : "title") as SortColumn,
    dir: dir === "desc" ? "desc" : "asc",
  };
}

export function serializeListState(state: ProblemListState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.difficulty.length) params.set("difficulty", state.difficulty.join(","));
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.status.length) params.set("status", state.status.join(","));
  if (state.sort !== "title") params.set("sort", state.sort);
  if (state.dir !== "asc") params.set("dir", state.dir);
  return params.toString();
}

export function applyListState(problems: Problem[], state: ProblemListState): Problem[] {
  const q = state.q.trim().toLowerCase();
  let rows = problems.filter((p) => {
    if (q && !p.title.toLowerCase().includes(q) && !p.tags.some((t) => t.includes(q))) return false;
    if (state.difficulty.length && !state.difficulty.includes(p.difficulty)) return false;
    if (state.status.length && !state.status.includes(p.status)) return false;
    if (state.tags.length && !state.tags.some((t) => p.tags.includes(t))) return false;
    return true;
  });

  const dirMul = state.dir === "asc" ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    switch (state.sort) {
      case "status":
        return dirMul * a.status.localeCompare(b.status);
      case "difficulty":
        return dirMul * (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
      case "acceptance":
        return dirMul * (a.acceptance - b.acceptance);
      case "title":
      default:
        return dirMul * a.title.localeCompare(b.title);
    }
  });

  return rows;
}

export function allTags(problems: Problem[]): string[] {
  const set = new Set<string>();
  for (const p of problems) for (const t of p.tags) set.add(t);
  return [...set].sort();
}
