#!/usr/bin/env node
/**
 * pnpm --filter @oocc/web gen:fixtures-data — copies fixtures/**.json and
 * their program sources into apps/web/lib/fixtures/data/, committed here
 * (same "generated but committed" precedent as packages/contracts/generated).
 *
 * Why a copy, not a runtime read of ../../fixtures: Vercel's "Root
 * Directory" project setting (set to apps/web for this monorepo) makes
 * everything outside it genuinely inaccessible to the deployed app —
 * Vercel's own docs are explicit that `..` traversal doesn't work, this
 * isn't just a file-tracing/bundling gap `outputFileTracingIncludes` can
 * paper over. `next dev`/`next build` run locally have no such
 * restriction, which is exactly why this looked fixed after local
 * testing and then 500'd on every fixture once actually deployed. The
 * only way `app/api/fixtures/[name]/route.ts` can read this data in
 * production is for it to already live inside apps/web before Vercel
 * ever clones the repo.
 *
 * Re-run this after adding/regenerating a fixture in fixtures/ or
 * fixtures/cpp/.
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const dataDir = resolve(webRoot, "lib/fixtures/data");

async function copyGlobInto(srcDir, destDir, predicate) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !predicate(entry.name)) continue;
    await cp(resolve(srcDir, entry.name), resolve(destDir, entry.name));
  }
}

async function main() {
  await rm(dataDir, { recursive: true, force: true });

  // Python fixtures: fixtures/*.{trace,analysis,plan}.json
  await copyGlobInto(
    resolve(repoRoot, "fixtures"),
    dataDir,
    (name) => name.endsWith(".trace.json") || name.endsWith(".analysis.json") || name.endsWith(".plan.json"),
  );
  // Python fixture program sources: fixtures/generator/programs/*.py
  await copyGlobInto(
    resolve(repoRoot, "fixtures/generator/programs"),
    resolve(dataDir, "programs"),
    (name) => name.endsWith(".py"),
  );

  // C++ fixtures: fixtures/cpp/*.{trace,analysis,plan}.json
  await copyGlobInto(
    resolve(repoRoot, "fixtures/cpp"),
    resolve(dataDir, "cpp"),
    (name) => name.endsWith(".trace.json") || name.endsWith(".analysis.json") || name.endsWith(".plan.json"),
  );
  // C++ fixture program sources: fixtures/cpp/programs/*.cpp
  await copyGlobInto(
    resolve(repoRoot, "fixtures/cpp/programs"),
    resolve(dataDir, "cpp/programs"),
    (name) => name.endsWith(".cpp"),
  );

  console.log(`[gen:fixtures-data] wrote apps/web/lib/fixtures/data/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
