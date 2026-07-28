import { CONCEPTS, conceptChannel } from "./concepts";
import type { ConceptProgressView, ProgressRecord } from "./types";

/**
 * Joins real/demo `ProgressRecord`s onto the full, static 12-concept set
 * (concepts.ts) so the concept graph always renders all 12 nodes — a
 * concept the learner has never touched shows up as an empty (near-zero
 * fill) node rather than being absent, which is the honest state ("not
 * started" is different from "doesn't exist").
 */
export function buildConceptViews(records: readonly ProgressRecord[]): ConceptProgressView[] {
  const byId = new Map(records.map((r) => [r.concept_id, r]));
  return CONCEPTS.map((concept) => {
    const record = byId.get(concept.id);
    return {
      conceptId: concept.id,
      title: concept.title,
      prereqIds: concept.prereqIds,
      mastery: record?.mastery ?? 0,
      lastSeenAt: record?.last_seen_at ?? null,
      nextReviewAt: record?.next_review_at ?? null,
      channel: conceptChannel(concept.id),
    };
  });
}

/** Only concepts with a real record (i.e. actually attempted at least
 * once) — unlike `buildConceptViews`, this deliberately drops the
 * never-touched 12-minus-N concepts, since "attempted and weak" or
 * "attempted and due for review" are the only meaningful states for the
 * review queue / weak-concepts lists (an unattempted concept is neither). */
export function buildAttemptedConceptViews(records: readonly ProgressRecord[]): ConceptProgressView[] {
  const all = buildConceptViews(records);
  const attempted = new Set(records.map((r) => r.concept_id));
  return all.filter((v) => attempted.has(v.conceptId));
}
