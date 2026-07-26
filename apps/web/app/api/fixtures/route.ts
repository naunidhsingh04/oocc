import { NextResponse } from "next/server";
import { FIXTURE_NAMES } from "@/lib/fixtures";

/**
 * Dev-only: lists the twelve fixture names for the workspace's fixture
 * picker. Phase 1 has no backend, so this and `[name]/route.ts` are the
 * only server code in apps/web — both refuse to run once built for
 * production, where a real /runs API takes over (docs/PRD.md §7 Phase 2).
 */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ fixtures: FIXTURE_NAMES });
}
