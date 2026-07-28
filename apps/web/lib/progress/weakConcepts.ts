import { ARTICLES } from "@/lib/curriculum/data";
import { PROBLEMS } from "@/lib/problems/data";
import { getConcept } from "./concepts";
import { WEAK_MASTERY_THRESHOLD } from "./mastery";
import type { ConceptProgressView, PracticeTarget } from "./types";

const ARTICLE_SLUGS = new Set(ARTICLES.map((a) => a.slug));

/**
 * Resolves one concept's "practice this" action (brief item 4): a
 * curriculum article when concepts.ts names one that actually still
 * exists, otherwise the first problem whose tags overlap the concept's
 * `problemTags`, otherwise `null` (rendered as "no practice material yet"
 * rather than a dead or fabricated link — infinite-loops is the one
 * concept this is currently true for, see concepts.ts).
 */
export function resolvePracticeTarget(conceptId: string): PracticeTarget {
  const concept = getConcept(conceptId);
  if (!concept) return null;

  if (concept.curriculumSlug && ARTICLE_SLUGS.has(concept.curriculumSlug)) {
    const article = ARTICLES.find((a) => a.slug === concept.curriculumSlug)!;
    return { kind: "curriculum", slug: article.slug, label: article.title };
  }

  if (concept.problemTags.length > 0) {
    const problem = PROBLEMS.find((p) => p.tags.some((tag) => concept.problemTags.includes(tag)));
    if (problem) {
      return { kind: "problem", slug: problem.slug, label: problem.title };
    }
  }

  return null;
}

/**
 * Weak concepts (brief item 4): attempted concepts below the mastery
 * threshold, weakest first. Callers pass `buildAttemptedConceptViews`'s
 * output — an unattempted concept is never "weak," it's simply not
 * started yet, which the concept graph already shows honestly on its own.
 */
export function selectWeakConcepts(
  attemptedViews: readonly ConceptProgressView[],
  limit = 6,
): ConceptProgressView[] {
  return [...attemptedViews]
    .filter((v) => v.mastery < WEAK_MASTERY_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
}
