/**
 * Plain-JS classic Web Worker (not processed by Next.js's bundler — it's
 * served as a static asset, loaded via `new Worker("/compiler/compilerWorker.js")`)
 * wrapping services/compiler-explorer's WASM module. Kept as a static
 * asset deliberately: Next's bundler has no first-class, low-risk story
 * for a `new Worker(new URL(...))` pointing at a hand-built Emscripten
 * artifact, so this sidesteps that entirely — the same pattern the WASM
 * glue file itself already uses (a self-contained script, loaded by URL).
 *
 * oocc_compiler.js (built with `-s ENVIRONMENT=web,worker,node` — see
 * services/compiler-explorer/CMakeLists.txt) is a classic script that
 * defines a global `OOCCCompiler` factory; `importScripts` is only valid
 * inside a classic (non-module) worker, which is exactly what this is.
 */

importScripts("/compiler/oocc_compiler.js");

let modulePromise = null;

function getModule() {
  if (!modulePromise) {
    // eslint-disable-next-line no-undef -- OOCCCompiler comes from importScripts above
    modulePromise = OOCCCompiler();
  }
  return modulePromise;
}

/**
 * Four calls, not one: `--emit=` stages are cumulative (each re-runs every
 * earlier stage internally, per pipeline.cpp), so timing four increasingly
 * complete requests and diffing consecutive wall-clock times approximates
 * per-stage cost without needing the WASM module itself to expose finer
 * timing — the language is tiny enough that 4x the work per keystroke is
 * still sub-millisecond, well inside the 200ms debounce budget.
 */
async function compileWithTimings(mod, source) {
  const timings = { lex: null, parse: null, compile: null, run: null };
  let previous = 0;
  let lastResult = null;
  let failedAt = null;

  const stops = [
    ["tokens", "lex"],
    ["ast", "parse"],
    ["bytecode", "compile"],
    ["all", "run"],
  ];

  for (const [emit, stageKey] of stops) {
    const t0 = performance.now();
    const raw = mod.compile(source, emit);
    const elapsed = performance.now() - t0;
    const parsed = JSON.parse(raw);

    if (failedAt === null) {
      timings[stageKey] = Math.max(0, elapsed - previous);
      previous = elapsed;
    }
    lastResult = parsed;
    if (parsed.error && failedAt === null) {
      failedAt = parsed.error.stage;
    }
  }

  return { result: lastResult, timings };
}

self.onmessage = async (event) => {
  const { id, source } = event.data;
  try {
    const mod = await getModule();
    const { result, timings } = await compileWithTimings(mod, source);
    self.postMessage({ id, ok: true, result, timings });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
