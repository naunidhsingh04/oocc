import type { Frame, Step, Trace } from "@oocc/contracts";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");

/** Loads a real, committed fixture (test-only helper — never used by app code). */
export function loadFixture(name: string): { trace: Trace; source: string } {
  const trace = JSON.parse(
    readFileSync(resolve(repoRoot, "fixtures", `${name}.trace.json`), "utf-8"),
  ) as Trace;
  const source = readFileSync(resolve(repoRoot, "fixtures/generator/programs", `${name}.py`), "utf-8");
  return { trace, source };
}

/**
 * A synthetic trace standing in for `large_trace_40k` in unit tests: cheap
 * to build, but the same shape and step count, and with runs of steps that
 * share a source line the way loop bodies do — required to prove editor
 * re-renders track the current *line*, not the raw step index.
 */
export function makeSyntheticTrace(stepCount: number): Trace {
  const steps: Step[] = [];
  for (let i = 0; i < stepCount; i += 1) {
    const line = 3 + (i % 4); // 4 lines repeat in a cycle, like a small loop body
    const frame: Frame = {
      frame_id: "f0",
      func: "loop",
      line,
      locals: { i: { val: i } },
    };
    steps.push({
      i,
      event: "line",
      line,
      func: "loop",
      depth: 1,
      stack: [frame],
      heap: {},
      stdout_delta: "",
      changed: i % 4 === 0 ? ["f0.i"] : [],
    });
  }

  return {
    schema_version: "1.0",
    run_id: "r_synthetic",
    language: "python",
    source_hash: `sha256:${"0".repeat(64)}`,
    status: "ok",
    meta: {
      duration_ms: 1,
      step_count: steps.length,
      truncated: false,
      stdin: "",
      peak_heap_objects: 0,
    },
    steps,
  };
}
