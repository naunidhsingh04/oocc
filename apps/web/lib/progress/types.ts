/**
 * Shapes for the Progress Dashboard (docs/PRD.md §8's `progress`/`concepts`
 * tables, `insights`/`runs` read indirectly through run history). Mirrors
 * `apps/api/app/routers/progress.py`'s `_record_out` shape exactly — this is
 * the same "shape matches the real endpoint so swapping transport later is
 * a non-event" precedent `lib/fixtures.ts`'s `FixtureBundle` and
 * `lib/problems/data.ts` already established.
 */

/** One row of `GET /api/progress` / `GET /api/progress/review-queue`. */
export interface ProgressRecord {
  concept_id: string;
  mastery: number;
  last_seen_at: string | null;
  next_review_at: string | null;
}

/** A `ProgressRecord` joined with its concept's static metadata
 * (title/prereqs/practice targets) — every component downstream of the
 * fetch works with this, never a bare `ProgressRecord` + a separate lookup. */
export interface ConceptProgressView {
  conceptId: string;
  title: string;
  prereqIds: readonly string[];
  mastery: number;
  lastSeenAt: string | null;
  nextReviewAt: string | null;
  /** Channel 1-8 (lib/player/channels.ts's mechanism) — stable per concept
   * id for the whole session, reused everywhere the concept appears. */
  channel: number;
}

export type PracticeTarget =
  | { kind: "curriculum"; slug: string; label: string }
  | { kind: "problem"; slug: string; label: string }
  | null;
