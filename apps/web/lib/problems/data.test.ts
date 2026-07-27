import { describe, expect, it } from "vitest";
import { isFixtureName } from "@/lib/fixtures";
import { PROBLEMS } from "./data";

// A typo in a fixture name (e.g. "binary_serach") wouldn't fail typecheck —
// FixtureName is a wide-enough union that plain strings still widen fine in
// places, and even where it wouldn't, a typo'd literal is just a different
// valid-looking string. Only a runtime check against the real fixture
// allowlist catches it, and there's no automatic re-check every time a
// problem is added, so this is worth asserting for real over all 13+.
describe("PROBLEMS data integrity", () => {
  it("every fixturePython/fixtureCpp reference is a real fixture name", () => {
    for (const p of PROBLEMS) {
      expect(isFixtureName(p.fixturePython), `${p.slug}: fixturePython "${p.fixturePython}"`).toBe(true);
      if (p.fixtureCpp) {
        expect(isFixtureName(p.fixtureCpp), `${p.slug}: fixtureCpp "${p.fixtureCpp}"`).toBe(true);
      }
    }
  });

  it("every slug is unique", () => {
    const slugs = PROBLEMS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every problem has at least one test case", () => {
    for (const p of PROBLEMS) {
      expect(p.testCases.length, `${p.slug} has no test cases`).toBeGreaterThan(0);
    }
  });

  it("hasSubmissionDemo is only set where a real generated demo exists", () => {
    const demoProblems = PROBLEMS.filter((p) => p.hasSubmissionDemo);
    expect(demoProblems.map((p) => p.slug)).toEqual(["binary-search"]);
  });
});
