import { CHANNEL_COUNT, channelColorVar } from "@/lib/player/channels";

/**
 * The twelve concept ids the Phase 5 backend's `concepts`/`progress` tables
 * actually key on — copied from `apps/api/app/rag/seed.py`'s
 * `CONCEPT_ARTICLES` (id + `prereq_ids` only; the article bodies live in
 * that file, not here). This is deliberately the *backend's* concept id
 * set, not `lib/curriculum/data.ts`'s article slugs — the two were built in
 * different phases for different purposes (RAG/full-article content vs.
 * this dashboard's progress model) and don't share slugs 1:1 (e.g. backend
 * `"linked-lists"` vs. frontend article `"linked-lists-and-pointers"`).
 * `curriculumSlug`/`problemTags` below are the hand-authored cross-reference
 * that reconciles them, in the same spirit as (and just as much a judgment
 * call as) `apps/api/app/routers/problems.py`'s own "a problem's tags double
 * as concept ids" docstring — flagged here for the same reason.
 */
export interface ConceptDef {
  id: string;
  title: string;
  prereqIds: readonly string[];
  /** The best-matching `lib/curriculum/data.ts` article slug, if one covers
   * this concept directly. Not every concept has a dedicated article. */
  curriculumSlug?: string;
  /** `lib/problems/data.ts` `Problem.tags` values that best exercise this
   * concept — used to find a "practice this" problem when no curriculum
   * article fits better, or as a second suggestion alongside one. */
  problemTags: readonly string[];
}

export const CONCEPTS: readonly ConceptDef[] = [
  {
    id: "big-o-notation",
    title: "Big-O Notation",
    prereqIds: [],
    // No dedicated article; binary-search's O(log n) walkthrough is the
    // frontend's clearest existing treatment of measured complexity. No
    // problem tag maps cleanly to "complexity" itself among
    // lib/problems/data.ts's tag vocabulary, so problemTags stays empty —
    // the curriculum link above is this concept's only practice target.
    curriculumSlug: "binary-search",
    problemTags: [],
  },
  {
    id: "call-stacks",
    title: "Call Stacks",
    prereqIds: [],
    curriculumSlug: "recursion-and-fibonacci",
    problemTags: ["recursion"],
  },
  {
    id: "infinite-loops",
    title: "Infinite Loops",
    prereqIds: [],
    // No article or problem models a runaway loop directly (it's a bug
    // pattern the insight scanner detects, not a curriculum topic or a
    // gradeable problem) — practice target intentionally absent.
    problemTags: [],
  },
  {
    id: "linked-lists",
    title: "Linked Lists",
    prereqIds: [],
    curriculumSlug: "linked-lists-and-pointers",
    problemTags: ["linked-list", "pointers"],
  },
  {
    id: "recursion",
    title: "Recursion",
    prereqIds: ["call-stacks"],
    curriculumSlug: "recursion-and-fibonacci",
    problemTags: ["recursion"],
  },
  {
    id: "hash-maps",
    title: "Hash Maps",
    prereqIds: ["big-o-notation"],
    curriculumSlug: "two-sum-and-hash-maps",
    problemTags: ["hash-map"],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    prereqIds: ["big-o-notation"],
    curriculumSlug: "binary-search",
    problemTags: ["binary-search"],
  },
  {
    id: "bubble-sort",
    title: "Bubble Sort",
    prereqIds: ["big-o-notation"],
    curriculumSlug: "bubble-sort",
    problemTags: ["sorting"],
  },
  {
    id: "bfs",
    title: "Breadth-First Search",
    prereqIds: ["linked-lists", "big-o-notation"],
    curriculumSlug: "breadth-first-search",
    problemTags: ["bfs", "graph", "queue"],
  },
  {
    id: "quicksort",
    title: "Quicksort",
    prereqIds: ["bubble-sort", "recursion"],
    curriculumSlug: "quicksort-and-partitioning",
    problemTags: ["sorting"],
  },
  {
    id: "backtracking",
    title: "Backtracking",
    prereqIds: ["recursion"],
    curriculumSlug: "backtracking-and-n-queens",
    problemTags: ["backtracking"],
  },
  {
    id: "dynamic-programming",
    title: "Dynamic Programming",
    prereqIds: ["recursion", "big-o-notation"],
    curriculumSlug: "dynamic-programming-and-knapsack",
    problemTags: ["dynamic-programming"],
  },
] as const;

export function getConcept(id: string): ConceptDef | undefined {
  return CONCEPTS.find((c) => c.id === id);
}

/**
 * One stable channel (1-8, round-robin) per concept id, in the declared
 * order above — the same "assign once, reuse everywhere" mechanism
 * `lib/player/channels.ts` uses for trace variables (`channelColorVar`),
 * applied here to concepts instead. Computed once at module load since the
 * concept list is static, not derived from a trace.
 */
const CONCEPT_CHANNELS: ReadonlyMap<string, number> = new Map(
  CONCEPTS.map((concept, i) => [concept.id, (i % CHANNEL_COUNT) + 1]),
);

export function conceptChannel(conceptId: string): number {
  return CONCEPT_CHANNELS.get(conceptId) ?? 1;
}

export function conceptChannelColor(conceptId: string): string {
  return channelColorVar(conceptChannel(conceptId));
}
