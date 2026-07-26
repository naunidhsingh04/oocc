import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { isFixtureName } from "@/lib/fixtures";

// apps/web/app/api/fixtures/[name] -> repo root is six levels up.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { name } = await context.params;
  if (!isFixtureName(name)) {
    return NextResponse.json({ error: `unknown fixture "${name}"` }, { status: 404 });
  }

  try {
    const [traceText, source, analysisText, planText] = await Promise.all([
      readFile(resolve(repoRoot, "fixtures", `${name}.trace.json`), "utf-8"),
      readFile(resolve(repoRoot, "fixtures/generator/programs", `${name}.py`), "utf-8"),
      readFile(resolve(repoRoot, "fixtures", `${name}.analysis.json`), "utf-8"),
      readFile(resolve(repoRoot, "fixtures", `${name}.plan.json`), "utf-8"),
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
