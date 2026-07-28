import { describe, expect, it } from "vitest";
import type { ConceptProgressView } from "./types";
import { daysOverdue, orderReviewQueue } from "./reviewQueue";

const NOW = new Date("2026-07-27T12:00:00.000Z");

function view(partial: Partial<ConceptProgressView> & { conceptId: string }): ConceptProgressView {
  return {
    title: partial.conceptId,
    prereqIds: [],
    mastery: 0.5,
    lastSeenAt: null,
    nextReviewAt: null,
    channel: 1,
    ...partial,
  };
}

describe("orderReviewQueue", () => {
  it("excludes concepts with no nextReviewAt or a future one", () => {
    const views = [
      view({ conceptId: "a", nextReviewAt: null }),
      view({ conceptId: "b", nextReviewAt: new Date(NOW.getTime() + 86400000).toISOString() }),
    ];
    expect(orderReviewQueue(views, NOW)).toEqual([]);
  });

  it("orders most-overdue first", () => {
    const views = [
      view({ conceptId: "a", nextReviewAt: new Date(NOW.getTime() - 1000).toISOString() }),
      view({ conceptId: "b", nextReviewAt: new Date(NOW.getTime() - 5 * 86400000).toISOString() }),
      view({ conceptId: "c", nextReviewAt: new Date(NOW.getTime() - 2 * 86400000).toISOString() }),
    ];
    expect(orderReviewQueue(views, NOW).map((v) => v.conceptId)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties on the same nextReviewAt by lowest mastery first", () => {
    const dueAt = new Date(NOW.getTime() - 86400000).toISOString();
    const views = [
      view({ conceptId: "high", nextReviewAt: dueAt, mastery: 0.9 }),
      view({ conceptId: "low", nextReviewAt: dueAt, mastery: 0.1 }),
    ];
    expect(orderReviewQueue(views, NOW).map((v) => v.conceptId)).toEqual(["low", "high"]);
  });

  it("includes a concept due at exactly now", () => {
    const views = [view({ conceptId: "a", nextReviewAt: NOW.toISOString() })];
    expect(orderReviewQueue(views, NOW).map((v) => v.conceptId)).toEqual(["a"]);
  });
});

describe("daysOverdue", () => {
  it("is 0 for something due in the future or right now", () => {
    expect(daysOverdue(NOW.toISOString(), NOW)).toBe(0);
    expect(daysOverdue(new Date(NOW.getTime() + 86400000).toISOString(), NOW)).toBe(0);
  });

  it("floors to whole days", () => {
    const threeAndAHalfDaysAgo = new Date(NOW.getTime() - 3.5 * 86400000).toISOString();
    expect(daysOverdue(threeAndAHalfDaysAgo, NOW)).toBe(3);
  });
});
