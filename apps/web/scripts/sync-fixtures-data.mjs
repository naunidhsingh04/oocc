#!/usr/bin/env node
/**
 * pnpm --filter @oocc/web gen:fixtures-data — merges each fixture's
 * trace/analysis/plan/source into one JSON file per fixture, written to
 * apps/web/public/fixtures-data/, committed here (same "generated but
 * committed" precedent as packages/contracts/generated).
 *
 * Why public/, not a Route Handler reading from a copy under lib/: this is
 * the *second* attempt at this fix, and the first one (route.ts reading
 * from apps/web/lib/fixtures/data/ via fs.readFile, with
 * `outputFileTracingIncludes` telling Vercel's build to bundle that
 * directory) still 500'd on the real Vercel deployment despite passing
 * every local `next build && next start` check — output file tracing is
 * a heuristic Next.js/@vercel/nft applies to statically-*unanalyzable*
 * fs reads, and its `outputFileTracingIncludes` route-key matching is
 * documented to run the key through picomatch as a glob (Next's own docs
 * example escapes literal brackets in a route key,
 * `/api/login/\\[\\[\\.\\.\\.slug\\]\\]`, which this file's previous
 * version's unescaped `/api/fixtures/[name]` key never did) — enough
 * moving, Vercel-only, locally-unverifiable parts that a second silent
 * failure was a real risk worth just not taking again.
 *
 * `public/` has none of that ambiguity: Next.js/Vercel always deploys the
 * entire `public/` directory verbatim as static assets, unconditionally,
 * with no tracing, no route-key matching, and no dependence on which
 * directory happens to be the deployment's "root." `lib/fixtures.ts`'s
 * `fetchFixture` now does a plain `fetch("/fixtures-data/<name>.json")`
 * instead of hitting `/api/fixtures/[name]` — a static GET has no server
 * code to misconfigure at all.
 *
 * Re-run this after adding/regenerating a fixture in fixtures/ or
 * fixtures/cpp/.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const outDir = resolve(webRoot, "public/fixtures-data");

async function baseNamesIn(dir, suffix) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(suffix))
    .map((e) => e.name.slice(0, -suffix.length));
}

async function writeBundle({ fixtureName, dataDir, programDir, programExt, baseName }) {
  const [trace, source, analysis, plan] = await Promise.all([
    readFile(resolve(dataDir, `${baseName}.trace.json`), "utf-8"),
    readFile(resolve(programDir, `${baseName}.${programExt}`), "utf-8"),
    readFile(resolve(dataDir, `${baseName}.analysis.json`), "utf-8"),
    readFile(resolve(dataDir, `${baseName}.plan.json`), "utf-8"),
  ]);
  const bundle = {
    trace: JSON.parse(trace),
    source,
    analysis: JSON.parse(analysis),
    plan: JSON.parse(plan),
  };
  await writeFile(resolve(outDir, `${fixtureName}.json`), JSON.stringify(bundle));
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const pythonDataDir = resolve(repoRoot, "fixtures");
  const pythonProgramDir = resolve(repoRoot, "fixtures/generator/programs");
  for (const baseName of await baseNamesIn(pythonDataDir, ".trace.json")) {
    await writeBundle({
      fixtureName: baseName,
      dataDir: pythonDataDir,
      programDir: pythonProgramDir,
      programExt: "py",
      baseName,
    });
  }

  const cppDataDir = resolve(repoRoot, "fixtures/cpp");
  const cppProgramDir = resolve(repoRoot, "fixtures/cpp/programs");
  for (const baseName of await baseNamesIn(cppDataDir, ".trace.json")) {
    await writeBundle({
      // Matches lib/fixtures.ts's CPP_FIXTURE_NAMES convention: the
      // picker-facing name is the base name with a "_cpp" suffix, kept
      // visibly distinct from the shared Python set.
      fixtureName: `${baseName}_cpp`,
      dataDir: cppDataDir,
      programDir: cppProgramDir,
      programExt: "cpp",
      baseName,
    });
  }

  console.log(`[gen:fixtures-data] wrote apps/web/public/fixtures-data/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
