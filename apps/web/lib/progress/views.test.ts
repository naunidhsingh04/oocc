import { describe, expect, it } from "vitest";
import { CONCEPTS } from "./concepts";
import type { ProgressRecord } from "./types";
import { buildAttemptedConceptViews, buildConceptViews } from "./views";

describe("buildConceptViews", () => {
  it("returns exactly one view per concept, in concept order, even with no records", () => {
    const views = buildConceptViews([]);
    expect(views.map((v) => v.conceptId)).toEqual(CONCEPTS.map((c) => c.id));
    expect(views.every((v) => v.mastery === 0)).toBe(true);
  });

  it("merges a record's mastery/timestamps onto its concept", () => {
    const records: ProgressRecord[] = [
      { concept_id: "binary-search", mastery: 0.77, last_seen_at: "2026-01-01T00:00:00Z", next_review_at: null },
    ];
    const views = buildConceptViews(records);
    const bs = views.find((v) => v.conceptId === "binary-search")!;
    expect(bs.mastery).toBe(0.77);
    expect(bs.lastSeenAt).toBe("2026-01-01T00:00:00Z");
  });
});

describe("buildAttemptedConceptViews", () => {
  it("only includes concepts with a real record", () => {
    const records: ProgressRecord[] = [
      { concept_id: "recursion", mastery: 0.3, last_seen_at: null, next_review_at: null },
    ];
    const views = buildAttemptedConceptViews(records);
    expect(views.map((v) => v.conceptId)).toEqual(["recursion"]);
  });

  it("is empty when there are no records", () => {
    expect(buildAttemptedConceptViews([])).toEqual([]);
  });
});
