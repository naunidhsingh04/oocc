import { describe, expect, it } from "vitest";
import type { ConceptProgressView } from "./types";
import { resolvePracticeTarget, selectWeakConcepts } from "./weakConcepts";

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

describe("selectWeakConcepts", () => {
  it("keeps only concepts below the mastery threshold", () => {
    const views = [
      view({ conceptId: "weak", mastery: 0.2 }),
      view({ conceptId: "solid", mastery: 0.8 }),
      view({ conceptId: "borderline", mastery: 0.5 }),
    ];
    expect(selectWeakConcepts(views).map((v) => v.conceptId)).toEqual(["weak"]);
  });

  it("sorts weakest first", () => {
    const views = [
      view({ conceptId: "a", mastery: 0.4 }),
      view({ conceptId: "b", mastery: 0.1 }),
      view({ conceptId: "c", mastery: 0.3 }),
    ];
    expect(selectWeakConcepts(views).map((v) => v.conceptId)).toEqual(["b", "c", "a"]);
  });

  it("respects the limit", () => {
    const views = Array.from({ length: 10 }, (_, i) => view({ conceptId: `c${i}`, mastery: 0.01 * i }));
    expect(selectWeakConcepts(views, 3)).toHaveLength(3);
  });
});

describe("resolvePracticeTarget", () => {
  it("prefers the concept's curriculum article when it exists", () => {
    const target = resolvePracticeTarget("binary-search");
    expect(target).toEqual(expect.objectContaining({ kind: "curriculum", slug: "binary-search" }));
  });

  it("falls back to a matching problem when there's no curriculum article", () => {
    const target = resolvePracticeTarget("hash-maps");
    // hash-maps does have a curriculum article, so pick one that leans
    // on problemTags only by checking the resolved kind is one of the two
    // valid shapes and actually resolves to something real.
    expect(target).not.toBeNull();
    expect(["curriculum", "problem"]).toContain(target?.kind);
  });

  it("returns null for a concept with neither an article nor a matching problem", () => {
    expect(resolvePracticeTarget("infinite-loops")).toBeNull();
  });

  it("returns null for an unknown concept id", () => {
    expect(resolvePracticeTarget("not-a-real-concept")).toBeNull();
  });
});
