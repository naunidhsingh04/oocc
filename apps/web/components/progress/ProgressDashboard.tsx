"use client";

import { fetchProgress, fetchReviewQueue } from "@/lib/progress/api";
import { buildDemoProgressRecords } from "@/lib/progress/demoData";
import { orderReviewQueue } from "@/lib/progress/reviewQueue";
import { hasActiveSession } from "@/lib/progress/session";
import { buildAttemptedConceptViews, buildConceptViews } from "@/lib/progress/views";
import { selectWeakConcepts } from "@/lib/progress/weakConcepts";
import type { ProgressRecord } from "@/lib/progress/types";
import { Chip, ErrorBoundary, Stagger, StaggerItem } from "@oocc/ui";
import { useEffect, useState } from "react";
import { ConceptGraph } from "./ConceptGraph";
import { ReviewQueue } from "./ReviewQueue";
import { RunHistory } from "./RunHistory";
import { WeakConcepts } from "./WeakConcepts";

interface LoadedState {
  progress: ProgressRecord[] | null;
  reviewQueue: ProgressRecord[] | null;
}

/**
 * `/progress` — brief items 1-4 assembled: concept graph, review queue,
 * run history, weak concepts. Checks `GET /api/auth/session` first
 * (`lib/progress/session.ts`, always 200) and only fires the real,
 * session-gated `GET /api/progress` + `GET /api/progress/review-queue`
 * (`lib/progress/api.ts`) when a session actually comes back — those two
 * routes 401 with no session by design (no meaningful anonymous view of
 * someone else's progress), so firing them unconditionally meant every
 * signed-out visitor got two logged 401s on every single page load.
 * Degrades to clearly-labeled demo data whenever there's no session (or
 * the API is unreachable), since there's no login UI in this frontend
 * yet. `progress === null` (not `[]`) is what "degrade" actually means
 * here — a real, signed-in, zero-rows response renders as a genuinely
 * empty (not demo) dashboard.
 */
export function ProgressDashboard() {
  const [state, setState] = useState<LoadedState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasActiveSession().then((signedIn) => {
      if (cancelled) return;
      if (!signedIn) {
        setState({ progress: null, reviewQueue: null });
        return;
      }
      void Promise.all([fetchProgress(), fetchReviewQueue()]).then(([progress, reviewQueue]) => {
        if (!cancelled) setState({ progress, reviewQueue });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const isDemo = state === null || state.progress === null;

  const progressRecords = state?.progress ?? buildDemoProgressRecords(now);
  const conceptViews = buildConceptViews(progressRecords);
  const attemptedViews = buildAttemptedConceptViews(progressRecords);
  const weakConcepts = selectWeakConcepts(attemptedViews);

  // The review-queue endpoint already returns the correctly-sorted set
  // when it's live; the demo fallback (and the "queue not yet loaded"
  // window) computes the identical ordering client-side (reviewQueue.ts)
  // over the same attempted concepts.
  const reviewRecords = state?.reviewQueue;
  const reviewQueueViews =
    reviewRecords !== undefined && reviewRecords !== null
      ? orderReviewQueue(buildConceptViews(reviewRecords), now)
      : orderReviewQueue(attemptedViews, now);

  return (
    <Stagger className="flex min-h-0 flex-1 flex-col gap-5 p-5">
      <StaggerItem className="flex shrink-0 items-center gap-3">
        <h1 className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">Progress</h1>
        {isDemo ? (
          <Chip tone="warn">Demo data — sign in to track your own progress</Chip>
        ) : (
          <Chip tone="ok">Live — your progress</Chip>
        )}
      </StaggerItem>

      <StaggerItem>
        <ErrorBoundary title="Concept graph">
          <ConceptGraph views={conceptViews} />
        </ErrorBoundary>
      </StaggerItem>

      <StaggerItem className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ErrorBoundary title="Review queue">
          <ReviewQueue queue={reviewQueueViews} now={now} />
        </ErrorBoundary>
        <ErrorBoundary title="Weak concepts">
          <WeakConcepts concepts={weakConcepts} />
        </ErrorBoundary>
      </StaggerItem>

      <StaggerItem>
        <ErrorBoundary title="Run history">
          <RunHistory />
        </ErrorBoundary>
      </StaggerItem>
    </Stagger>
  );
}
