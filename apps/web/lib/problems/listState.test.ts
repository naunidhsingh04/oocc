import { describe, expect, it } from "vitest";
import type { Problem } from "./types";
import {
  allTags,
  applyListState,
  DEFAULT_LIST_STATE,
  parseListState,
  serializeListState,
  type ProblemListState,
} from "./listState";

function problem(overrides: Partial<Problem>): Problem {
  return {
    slug: "p",
    title: "P",
    difficulty: "easy",
    tags: [],
    acceptance: 50,
    status: "todo",
    statementMd: "",
    fixturePython: "binary_search",
    starterPython: "",
    testCases: [],
    ...overrides,
  };
}

const SAMPLE: Problem[] = [
  problem({ slug: "a", title: "Apple", difficulty: "easy", status: "solved", acceptance: 80, tags: ["array"] }),
  problem({ slug: "b", title: "Banana", difficulty: "hard", status: "todo", acceptance: 20, tags: ["graph"] }),
  problem({ slug: "c", title: "Cherry", difficulty: "medium", status: "attempted", acceptance: 50, tags: ["array", "dp"] }),
];

describe("parseListState / serializeListState", () => {
  it("round-trips through a query string", () => {
    const state: ProblemListState = {
      q: "sort",
      difficulty: ["easy", "hard"],
      tags: ["array"],
      status: ["solved"],
      sort: "acceptance",
      dir: "desc",
    };
    const qs = serializeListState(state);
    const parsed = parseListState(new URLSearchParams(qs));
    expect(parsed).toEqual(state);
  });

  it("parses an empty URLSearchParams as the default state", () => {
    expect(parseListState(new URLSearchParams())).toEqual(DEFAULT_LIST_STATE);
  });

  it("serializes the default state to an empty string — a clean URL, no noise", () => {
    expect(serializeListState(DEFAULT_LIST_STATE)).toBe("");
  });

  it("ignores an invalid sort column rather than throwing", () => {
    const parsed = parseListState(new URLSearchParams("sort=not-a-real-column"));
    expect(parsed.sort).toBe("title");
  });
});

describe("applyListState", () => {
  it("filters by search text across title and tags", () => {
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, q: "cherry" });
    expect(rows.map((p) => p.slug)).toEqual(["c"]);
  });

  it("filters by difficulty (OR within the facet)", () => {
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, difficulty: ["easy", "hard"] });
    expect(rows.map((p) => p.slug).sort()).toEqual(["a", "b"]);
  });

  it("filters by status", () => {
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, status: ["solved"] });
    expect(rows.map((p) => p.slug)).toEqual(["a"]);
  });

  it("filters by tag membership", () => {
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, tags: ["dp"] });
    expect(rows.map((p) => p.slug)).toEqual(["c"]);
  });

  it("combines filters with AND semantics across facets", () => {
    // "array" tag AND "easy" difficulty -> only "a", even though "c" also has "array".
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, tags: ["array"], difficulty: ["easy"] });
    expect(rows.map((p) => p.slug)).toEqual(["a"]);
  });

  it("sorts by acceptance ascending and descending", () => {
    const asc = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, sort: "acceptance", dir: "asc" });
    expect(asc.map((p) => p.slug)).toEqual(["b", "c", "a"]);
    const desc = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, sort: "acceptance", dir: "desc" });
    expect(desc.map((p) => p.slug)).toEqual(["a", "c", "b"]);
  });

  it("sorts by difficulty rank, not alphabetically (easy < medium < hard)", () => {
    const rows = applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, sort: "difficulty", dir: "asc" });
    expect(rows.map((p) => p.slug)).toEqual(["a", "c", "b"]);
  });

  it("never mutates the input array", () => {
    const copy = [...SAMPLE];
    applyListState(SAMPLE, { ...DEFAULT_LIST_STATE, sort: "acceptance" });
    expect(SAMPLE).toEqual(copy);
  });
});

describe("allTags", () => {
  it("collects and sorts every distinct tag across problems", () => {
    expect(allTags(SAMPLE)).toEqual(["array", "dp", "graph"]);
  });
});
