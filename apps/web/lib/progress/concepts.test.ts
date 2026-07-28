import { describe, expect, it } from "vitest";
import { ARTICLES } from "@/lib/curriculum/data";
import { PROBLEMS } from "@/lib/problems/data";
import { CONCEPTS, conceptChannel } from "./concepts";

describe("CONCEPTS data integrity", () => {
  it("every concept id is unique", () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every prereqId points at a real concept in this set (no dangling prereqs)", () => {
    const ids = new Set(CONCEPTS.map((c) => c.id));
    for (const concept of CONCEPTS) {
      for (const prereq of concept.prereqIds) {
        expect(ids.has(prereq), `${concept.id} lists missing prereq "${prereq}"`).toBe(true);
      }
    }
  });

  it("the prereq graph has no cycles (every concept reaches a root)", () => {
    const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
    function assertAcyclic(id: string, seen: Set<string>) {
      expect(seen.has(id), `cycle detected reaching "${id}"`).toBe(false);
      const next = new Set(seen).add(id);
      for (const prereq of byId.get(id)?.prereqIds ?? []) {
        assertAcyclic(prereq, next);
      }
    }
    for (const concept of CONCEPTS) {
      assertAcyclic(concept.id, new Set());
    }
  });

  it("every curriculumSlug (when set) resolves to a real article", () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    for (const concept of CONCEPTS) {
      if (concept.curriculumSlug) {
        expect(slugs.has(concept.curriculumSlug), `${concept.id} -> missing article "${concept.curriculumSlug}"`).toBe(
          true,
        );
      }
    }
  });

  it("every problemTags entry is a tag that actually appears on at least one problem, or the list is empty", () => {
    const allTags = new Set(PROBLEMS.flatMap((p) => p.tags));
    for (const concept of CONCEPTS) {
      for (const tag of concept.problemTags) {
        expect(allTags.has(tag), `${concept.id} references unused problem tag "${tag}"`).toBe(true);
      }
    }
  });

  it("assigns a channel (1-8) to every concept, stably", () => {
    for (const concept of CONCEPTS) {
      const channel = conceptChannel(concept.id);
      expect(channel).toBeGreaterThanOrEqual(1);
      expect(channel).toBeLessThanOrEqual(8);
      expect(conceptChannel(concept.id)).toBe(channel);
    }
  });
});
