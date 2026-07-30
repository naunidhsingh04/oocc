import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fetchProgress, fetchReviewQueue } from "@/lib/progress/api";
import { hasActiveSession } from "@/lib/progress/session";
import { ProgressDashboard } from "./ProgressDashboard";

vi.mock("@/lib/progress/session", () => ({
  hasActiveSession: vi.fn(),
}));
vi.mock("@/lib/progress/api", () => ({
  fetchProgress: vi.fn(),
  fetchReviewQueue: vi.fn(),
}));
// Isolates the gating logic under test from every child panel's own
// rendering/fetching (RunHistory pulls fixture data, ConceptGraph does
// layout work neither of which this test cares about).
vi.mock("./ConceptGraph", () => ({ ConceptGraph: () => null }));
vi.mock("./ReviewQueue", () => ({ ReviewQueue: () => null }));
vi.mock("./WeakConcepts", () => ({ WeakConcepts: () => null }));
vi.mock("./RunHistory", () => ({ RunHistory: () => null }));

const mockHasActiveSession = vi.mocked(hasActiveSession);
const mockFetchProgress = vi.mocked(fetchProgress);
const mockFetchReviewQueue = vi.mocked(fetchReviewQueue);

describe("ProgressDashboard", () => {
  // No test asserts the transient "now === null" skeleton render directly:
  // React Testing Library's render() flushes effects synchronously before
  // returning (unlike a real browser, where the client's first paint and
  // its effects are genuinely separate ticks), so by the time an
  // assertion could run, `setNow`'s effect has already resolved past it.
  // The guarantee this component actually needs — the server's render and
  // the client's *first* render produce identical output — isn't
  // something RTL can observe at all (it never does real SSR); it's
  // covered by not calling `new Date()`/reading storage directly in the
  // render body, not by a test that would just be asserting RTL's own
  // effect-flushing behavior.

  it("never calls the session-gated progress endpoints when there's no session", async () => {
    mockHasActiveSession.mockResolvedValue(false);

    render(<ProgressDashboard />);

    await waitFor(() => expect(screen.getByText(/Demo data/)).toBeInTheDocument());
    expect(mockFetchProgress).not.toHaveBeenCalled();
    expect(mockFetchReviewQueue).not.toHaveBeenCalled();
  });

  it("calls the progress endpoints only once a session is confirmed", async () => {
    mockHasActiveSession.mockResolvedValue(true);
    mockFetchProgress.mockResolvedValue([]);
    mockFetchReviewQueue.mockResolvedValue([]);

    render(<ProgressDashboard />);

    await waitFor(() => expect(screen.getByText(/Live/)).toBeInTheDocument());
    expect(mockFetchProgress).toHaveBeenCalledOnce();
    expect(mockFetchReviewQueue).toHaveBeenCalledOnce();
  });
});
