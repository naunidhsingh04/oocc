import type { ConceptProgressView } from "./types";

/**
 * Client-side mirror of `apps/api/app/progress/review_queue.py`'s
 * `get_review_queue`: due concepts (a `nextReviewAt` in the past), most
 * overdue first, ties broken by lowest mastery. Needed here too because
 * the demo-data fallback path has no backend to compute this for it — see
 * `lib/progress/demoData.ts`'s docstring for when this runs instead of the
 * real endpoint's own already-sorted response.
 */
export function orderReviewQueue(views: readonly ConceptProgressView[], now: Date): ConceptProgressView[] {
  const due = views.filter((v) => v.nextReviewAt !== null && new Date(v.nextReviewAt).getTime() <= now.getTime());
  return [...due].sort((a, b) => {
    const aTime = new Date(a.nextReviewAt!).getTime();
    const bTime = new Date(b.nextReviewAt!).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.mastery - b.mastery;
  });
}

/** Whole days overdue (>= 0), for the review queue's one honest number —
 * "how late is this," which changes whether a learner reviews it today. */
export function daysOverdue(nextReviewAt: string, now: Date): number {
  const ms = now.getTime() - new Date(nextReviewAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
