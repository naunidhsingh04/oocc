import { API_BASE_URL } from "@/lib/api/client";
import type { ProgressRecord } from "./types";

/**
 * The real Phase 5 backend (`apps/api/app/routers/progress.py`), both
 * routes session-gated via a signed cookie. There's no login UI in this
 * frontend yet (out of scope for this session — see the phase brief), so
 * in practice every call here 401s in this dev sandbox; `credentials:
 * "include"` is still correct so a real session cookie *would* be sent the
 * moment a login flow exists, without touching this file again. Both
 * functions degrade to `null` on any non-2xx status or network failure —
 * indistinguishable from "not signed in," which is the honest state, and
 * the same never-throw contract `lib/api/client.ts`'s `fetchRunExtras`
 * already established for Phase 3's AI surfaces. `null` here specifically
 * means "fall back to demo data"; `[]` (a real empty array) means "signed
 * in, zero rows yet" and must render as a real, if empty, state — the two
 * are deliberately different types of "nothing."
 */
export async function fetchProgress(): Promise<ProgressRecord[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/progress`, { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as ProgressRecord[];
  } catch {
    return null;
  }
}

export async function fetchReviewQueue(): Promise<ProgressRecord[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/progress/review-queue`, { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as ProgressRecord[];
  } catch {
    return null;
  }
}
