import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { CPP_FIXTURE_NAMES, isFixtureName } from "@/lib/fixtures";

// apps/web/app/api/fixtures/[name] -> apps/web/lib/fixtures/data is four
// levels up then down into lib/fixtures/data.
const dataRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../lib/fixtures/data");

// Serves fixture data committed at apps/web/lib/fixtures/data/ (generated
// by `pnpm --filter @oocc/web gen:fixtures-data` from the canonical
// fixtures/ — see that script's own docstring) — used by the landing page
// demo, curriculum's EmbeddedTrace, Compare, the dev FixturePicker, and
// problem visualization (lib/fixtures.ts's callers).
//
// This used to read straight from ../../fixtures (outside apps/web) via a
// runtime-computed path. That 404'd outside `next dev` on the theory that
// it was a throwaway dev-only stand-in — fixed once to serve in
// production too, but the fix (`outputFileTracingIncludes` pointing at
// `../../fixtures`) still 500'd on a real Vercel deploy: Vercel's own
// "Root Directory" project setting (set to apps/web for this monorepo)
// makes `..` traversal outside the root directory genuinely inaccessible
// to the deployed app, not just a file-tracing gap — their docs say so
// explicitly. `next build`/`next start` run locally have no such
// restriction, which is exactly why that fix looked correct after local
// testing and then broke on every single fixture once actually deployed.
// The only reliable fix is for the data to already live inside apps/web,
// committed, before Vercel ever clones the repo — hence the copy.
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!isFixtureName(name)) {
    return NextResponse.json({ error: `unknown fixture "${name}"` }, { status: 404 });
  }

  // C++ fixtures (Phase 4, docs/PRD.md §3.5) live under data/cpp/, named
  // "<name>_cpp" in the picker to keep them visibly distinct from the
  // shared, append-only twelve-fixture Python set — see lib/fixtures.ts's
  // CPP_FIXTURE_NAMES.
  const isCpp = (CPP_FIXTURE_NAMES as readonly string[]).includes(name);
  const baseName = isCpp ? name.replace(/_cpp$/, "") : name;
  const dir = isCpp ? resolve(dataRoot, "cpp") : dataRoot;
  const programExt = isCpp ? "cpp" : "py";
  const programDir = isCpp ? resolve(dataRoot, "cpp/programs") : resolve(dataRoot, "programs");

  try {
    const [traceText, source, analysisText, planText] = await Promise.all([
      readFile(resolve(dir, `${baseName}.trace.json`), "utf-8"),
      readFile(resolve(programDir, `${baseName}.${programExt}`), "utf-8"),
      readFile(resolve(dir, `${baseName}.analysis.json`), "utf-8"),
      readFile(resolve(dir, `${baseName}.plan.json`), "utf-8"),
    ]);
    return NextResponse.json({
      trace: JSON.parse(traceText) as unknown,
      source,
      analysis: JSON.parse(analysisText) as unknown,
      plan: JSON.parse(planText) as unknown,
    });
  } catch (error) {
    // A bare 500 with no logged cause is exactly what made the Root
    // Directory bug (see the module docstring above) so slow to track
    // down — the route "just" 500'd, with nothing in Vercel's function
    // logs pointing at *why* (ENOENT on a specific path? a JSON parse
    // failure? something else?). console.error here lands in Vercel's
    // function logs (and the terminal under `next dev`), so the next
    // failure — a bad regeneration, a missing file, anything — shows its
    // real cause immediately instead of requiring a fresh investigation.
    console.error(`/api/fixtures/${name}: failed to load fixture data`, error);
    return NextResponse.json({ error: `could not read fixture "${name}"` }, { status: 500 });
  }
}
