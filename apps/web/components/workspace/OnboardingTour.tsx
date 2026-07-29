"use client";

import { hasTourBeenSeen, markTourSeen } from "@/lib/onboarding/store";
import { usePlayerStore } from "@/lib/player";
import { Button } from "@oocc/ui";
import { useEffect, useState } from "react";

interface TourStep {
  target: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: "editor",
    title: "1. Your code",
    body: "This is a real trace already running — edit it and OOCC re-traces every step.",
  },
  {
    target: "ribbon",
    title: "2. The ribbon",
    body: "Every step of execution as one tick. Click or drag to scrub anywhere in the run.",
  },
  {
    target: "panels",
    title: "3. Live panels",
    body: "Data structures update in lockstep with the ribbon — no separate debugger to configure.",
  },
  {
    target: "tutor",
    title: "4. Ask the tutor",
    body: "Questions are answered grounded in this exact run, with clickable steps as evidence.",
  },
];

function useTargetRect(target: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!target) {
      // Synchronizing with an external system (the DOM node a step points
      // at) — there's no target to measure, so the rect resets to match,
      // the same "no event to subscribe to instead" case usePipeline.ts's
      // own `compiling` flag already documents.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      return;
    }
    function measure() {
      const el = document.querySelector(`[data-tour="${target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener("resize", measure);
    // The ribbon/panels can change height as content loads — a couple of
    // deferred re-measures cheaply cover that without a ResizeObserver
    // per step.
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [target]);

  return rect;
}

/**
 * docs/PRD.md §9: "A four-step tour that runs inside the real workspace on
 * a real trace, skippable and never shown twice." Deliberately not a
 * modal over a screenshot — it measures and highlights the actual mounted
 * DOM (`[data-tour="..."]` markers in `Workspace.tsx`) so what it points
 * at is exactly what's on screen, including whatever fixture happens to
 * be loaded. `hasTourBeenSeen`/`markTourSeen` (lib/onboarding/store.ts)
 * are the only persistence — no separate "dismissed" component state that
 * could drift from it.
 */
export function OnboardingTour() {
  const trace = usePlayerStore((state) => state.trace);
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  useEffect(() => {
    if (trace && stepIndex === null && !hasTourBeenSeen()) {
      // Synchronizes with `lib/onboarding/store.ts`'s localStorage flag,
      // an external system checked once a real trace becomes available —
      // same class of exemption as the rect reset above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
    }
    // Deliberately only re-checks once a trace becomes available — this
    // effect never re-triggers `stepIndex` back to 0 once the tour has
    // started or been dismissed within this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace]);

  const step = stepIndex !== null ? STEPS[stepIndex] : null;
  const rect = useTargetRect(step?.target ?? null);

  if (!step) return null;

  function finish() {
    markTourSeen();
    setStepIndex(null);
  }

  function next() {
    if (stepIndex === null) return;
    if (stepIndex + 1 >= STEPS.length) {
      finish();
    } else {
      setStepIndex(stepIndex + 1);
    }
  }

  const cardTop = rect ? Math.min(window.innerHeight - 160, Math.max(12, rect.top)) : 12;
  const cardLeft = rect ? Math.min(window.innerWidth - 300, Math.max(12, rect.left)) : 12;

  return (
    <>
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 border-2 border-signal"
          style={{ top: rect.top - 2, left: rect.left - 2, width: rect.width + 4, height: rect.height + 4 }}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={step.title}
        className="fixed z-50 flex w-72 flex-col gap-2 border border-rule bg-panel p-3 shadow-menu"
        style={{ top: cardTop, left: cardLeft }}
      >
        <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">{step.title}</span>
        <p className="font-body text-[13px] text-ink">{step.body}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono-label text-[10px] text-ink-soft">
            {stepIndex! + 1} / {STEPS.length}
          </span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip tour
            </Button>
            <Button variant="primary" size="sm" onClick={next}>
              {stepIndex! + 1 >= STEPS.length ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
