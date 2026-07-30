import { API_BASE_URL } from "@/lib/api/client";

/**
 * `GET /api/auth/session` is always 200 (`{"user": null}` when signed
 * out) — unlike the session-gated `/api/progress`/`/api/progress/review-queue`
 * routes it exists to guard, which 401 with no session by design (brief
 * item 3: no meaningful anonymous view of someone else's progress).
 * `ProgressDashboard` calls this first and only fires those two calls when
 * a user comes back, instead of firing them unconditionally and treating
 * "401" as the signed-out signal — that used to mean every signed-out
 * visitor got two logged 401s on every single page load.
 *
 * Returns `null` on network failure too (unreachable API, same as every
 * other fetch in `lib/api/client.ts`/`lib/progress/api.ts`) — indistinguishable
 * from "signed out" on purpose, which is the correct fallback either way.
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" });
    if (!response.ok) return false;
    const data = (await response.json()) as { user: unknown };
    return data.user !== null;
  } catch {
    return false;
  }
}
