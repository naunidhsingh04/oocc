"use client";

import type { Value } from "@oocc/contracts";
import { Chip, Skeleton } from "@oocc/ui";
import { useEffect, useRef, useState } from "react";
import { fetchFixture, type FixtureBundle } from "@/lib/fixtures";
import { useEmbeddedTrace } from "@/lib/curriculum/useEmbeddedTrace";
import { MiniRibbon } from "@/components/curriculum/MiniRibbon";

const DEMO_FIXTURE = "bubble_sort";

function formatValue(value: Value | undefined): string {
  if (value === null || value === undefined) return "None";
  if ("val" in value) return value.repr ?? JSON.stringify(value.val);
  if ("ref" in value) return value.ref;
  return "";
}

/**
 * The home page's entire pitch (docs/PRD.md §6: "show someone what this
 * product does in five seconds") — a real, already-running trace, not a
 * screenshot or a video. Deliberately its own local-state playback
 * (`useEmbeddedTrace`, the same hook curriculum articles use), never the
 * page-wide `usePlayerStore` singleton: `/play` is a separate route now
 * (see `components/home/`'s own docstring on `HomePage.tsx`), and sharing
 * one store between them would mean a visitor's real in-progress code at
 * `/play` bleeds into this canned demo the moment they navigate back here,
 * or vice versa. Best-effort like every other fixture-backed surface:
 * `fetchFixture` now works in production (a static asset under `public/`
 * — see its own docstring), but the try/catch below stays regardless, so
 * a genuine network hiccup degrades to "the section doesn't render" and
 * never to a crash on the very first thing a visitor sees.
 */
export function HeroDemo() {
  const [bundle, setBundle] = useState<FixtureBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFixture(DEMO_FIXTURE)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch(() => {
        // A genuine network failure — the section below just never
        // mounts. Never a crash.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bundle) {
    return (
      <div className="w-full max-w-2xl space-y-2 rounded-panel border border-rule bg-panel p-3 shadow-raised">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }

  return <HeroDemoLoaded bundle={bundle} />;
}

function HeroDemoLoaded({ bundle }: { bundle: FixtureBundle }) {
  const { trace, source } = bundle;
  const { currentStep, step, playing, channels, ticks, jumpTo, togglePlay, lastIndex } = useEmbeddedTrace(trace);
  const userInteracted = useRef(false);
  const startedRef = useRef(false);

  // A visitor touching the demo (scrubbing it, clicking anywhere on the
  // page) stops the auto-loop below — a first-visit affordance, never a
  // hijack of someone who paused deliberately to read a step.
  useEffect(() => {
    const markInteracted = () => {
      userInteracted.current = true;
    };
    window.addEventListener("pointerdown", markInteracted, { capture: true });
    window.addEventListener("keydown", markInteracted, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", markInteracted, { capture: true });
      window.removeEventListener("keydown", markInteracted, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    togglePlay();
  }, [togglePlay]);

  useEffect(() => {
    if (playing || currentStep < lastIndex || lastIndex <= 0) return;
    if (userInteracted.current) return;
    // `togglePlay` itself resets to step 0 when called while paused at the
    // end (see `useEmbeddedTrace.ts`) — no separate `jumpTo(0)` needed.
    const id = setTimeout(togglePlay, 1200);
    return () => clearTimeout(id);
  }, [playing, currentStep, lastIndex, togglePlay]);

  const lines = source.split("\n");
  const currentLine = step?.line ?? 0;
  const topFrame = step?.stack[step.stack.length - 1];
  const changedLocals = step
    ? step.changed
        .map((path) => /^f\d+\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(path)?.[1])
        .filter((name): name is string => Boolean(name) && Boolean(topFrame?.locals[name!]))
    : [];

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-panel border border-rule bg-panel shadow-raised">
      <pre className="max-h-72 overflow-auto px-4 py-3 font-editor text-[14px] leading-[1.7]">
        {lines.map((line, i) => {
          const lineNumber = i + 1;
          const isCurrent = lineNumber === currentLine;
          return (
            <div key={lineNumber} className={isCurrent ? "-mx-4 bg-signal/10 px-4" : undefined}>
              <span className="mr-3 inline-block w-6 select-none text-right text-ink-soft/60">{lineNumber}</span>
              <span className={isCurrent ? "text-ink" : "text-ink-soft"}>{line || " "}</span>
            </div>
          );
        })}
      </pre>
      <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 border-t border-rule px-4 py-2">
        {changedLocals.length > 0 ? (
          changedLocals.map((name) => (
            <Chip key={name} channel={(channels.get(name) ?? 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>
              {name} = {formatValue(topFrame?.locals[name])}
            </Chip>
          ))
        ) : (
          <span className="font-body text-[13px] text-ink-soft">Watching bubble sort run…</span>
        )}
      </div>
      <div className="border-t border-rule px-4 py-2.5">
        <MiniRibbon ticks={ticks} currentStep={currentStep} onScrub={jumpTo} />
      </div>
    </div>
  );
}
