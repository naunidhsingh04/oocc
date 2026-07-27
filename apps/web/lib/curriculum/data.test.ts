import { describe, expect, it } from "vitest";
import { isFixtureName } from "@/lib/fixtures";
import { ARTICLES } from "./data";

const TRACE_FENCE = /```trace:(\S+)\n```/g;

describe("ARTICLES data integrity", () => {
  it("every slug is unique", () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every embedded ```trace: fence references a real fixture name", () => {
    for (const article of ARTICLES) {
      const fixtures = [...article.bodyMd.matchAll(TRACE_FENCE)].map((m) => m[1]);
      expect(fixtures.length, `${article.slug} has no embedded traces`).toBeGreaterThan(0);
      for (const fixture of fixtures) {
        expect(fixture, `${article.slug}: unparsed embedded trace fence`).toBeDefined();
        expect(isFixtureName(fixture ?? ""), `${article.slug}: embedded fixture "${fixture}"`).toBe(true);
      }
    }
  });

  it("every relatedSlugs entry points at a real article (no dead interlinks)", () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    for (const article of ARTICLES) {
      for (const related of article.relatedSlugs) {
        expect(slugs.has(related), `${article.slug} links to missing article "${related}"`).toBe(true);
      }
    }
  });

  it("every /curriculum/ and /problems/ link inside bodyMd points at something real", () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    const linkPattern = /\]\(\/curriculum\/([a-z0-9-]+)\)/g;
    for (const article of ARTICLES) {
      for (const match of article.bodyMd.matchAll(linkPattern)) {
        expect(slugs.has(match[1]!), `${article.slug} links to missing article "${match[1]}"`).toBe(true);
      }
    }
  });
});
