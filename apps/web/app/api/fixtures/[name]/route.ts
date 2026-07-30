import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { CPP_FIXTURE_NAMES, isFixtureName } from "@/lib/fixtures";

// apps/web/app/api/fixtures/[name] -> repo root is six levels up.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

// Serves the committed fixtures/**.json + program source directly — used
// by the landing page demo, curriculum's EmbeddedTrace, Compare, the dev
// FixturePicker, and problem visualization (lib/fixtures.ts's callers).
// This used to 404 outside `next dev` on the theory that it was a
// throwaway stand-in for a real run API — but nothing ever replaced it,
// so every one of those surfaces was silently broken on a production
// deploy (e.g. Vercel). The data itself (committed, static, non-
// sensitive) is perfectly fine to serve in production; the only actual
// production gap was Vercel's build-time file tracer not knowing to
// bundle fixtures/** for this route, since the paths below are computed
// at runtime rather than statically imported — see
// `outputFileTracingIncludes` in next.config.ts, which fixes that.
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!isFixtureName(name)) {
    return NextResponse.json({ error: `unknown fixture "${name}"` }, { status: 404 });
  }

  // C++ fixtures (Phase 4, docs/PRD.md §3.5) live under fixtures/cpp/,
  // named "<name>_cpp" in the picker to keep them visibly distinct from
  // the shared, append-only twelve-fixture Python set — see
  // lib/fixtures.ts's CPP_FIXTURE_NAMES.
  const isCpp = (CPP_FIXTURE_NAMES as readonly string[]).includes(name);
  const baseName = isCpp ? name.replace(/_cpp$/, "") : name;
  const dir = isCpp ? "fixtures/cpp" : "fixtures";
  const programExt = isCpp ? "cpp" : "py";
  const programDir = isCpp ? "fixtures/cpp/programs" : "fixtures/generator/programs";

  try {
    const [traceText, source, analysisText, planText] = await Promise.all([
      readFile(resolve(repoRoot, dir, `${baseName}.trace.json`), "utf-8"),
      readFile(resolve(repoRoot, programDir, `${baseName}.${programExt}`), "utf-8"),
      readFile(resolve(repoRoot, dir, `${baseName}.analysis.json`), "utf-8"),
      readFile(resolve(repoRoot, dir, `${baseName}.plan.json`), "utf-8"),
    ]);
    return NextResponse.json({
      trace: JSON.parse(traceText) as unknown,
      source,
      analysis: JSON.parse(analysisText) as unknown,
      plan: JSON.parse(planText) as unknown,
    });
  } catch {
    return NextResponse.json({ error: `could not read fixture "${name}"` }, { status: 500 });
  }
}
