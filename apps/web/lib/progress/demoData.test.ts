import { describe, expect, it } from "vitest";
import { CONCEPTS } from "./concepts";
import { FIXTURE_NAMES } from "@/lib/fixtures";
import { buildDemoProgressRecords, buildDemoRunEntries } from "./demoData";

describe("buildDemoProgressRecords", () => {
  const conceptIds = new Set(CONCEPTS.map((c) => c.id));

  it("every record references a real concept id", () => {
    for (const record of buildDemoProgressRecords()) {
      expect(conceptIds.has(record.concept_id), record.concept_id).toBe(true);
    }
  });

  it("mastery values are within [0, 1]", () => {
    for (const record of buildDemoProgressRecords()) {
      expect(record.mastery).toBeGreaterThanOrEqual(0);
      expect(record.mastery).toBeLessThanOrEqual(1);
    }
  });

  it("includes at least one overdue (due-for-review) concept and one weak concept", () => {
    const now = new Date("2026-07-27T00:00:00Z");
    const records = buildDemoProgressRecords(now);
    const overdue = records.filter((r) => r.next_review_at && new Date(r.next_review_at) <= now);
    const weak = records.filter((r) => r.mastery < 0.5);
    expect(overdue.length).toBeGreaterThan(0);
    expect(weak.length).toBeGreaterThan(0);
  });

  it("timestamps move with the supplied `now`", () => {
    const a = buildDemoProgressRecords(new Date("2026-01-01T00:00:00Z"));
    const b = buildDemoProgressRecords(new Date("2027-01-01T00:00:00Z"));
    expect(a[0]!.next_review_at).not.toBe(b[0]!.next_review_at);
  });
});

describe("buildDemoRunEntries", () => {
  it("every entry references a real fixture name", () => {
    const names = new Set<string>(FIXTURE_NAMES);
    for (const entry of buildDemoRunEntries()) {
      expect(names.has(entry.fixture), entry.fixture).toBe(true);
    }
  });

  it("every entry has a unique id", () => {
    const ids = buildDemoRunEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
