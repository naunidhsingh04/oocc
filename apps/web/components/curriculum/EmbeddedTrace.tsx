"use client";

import type { Value } from "@oocc/contracts";
import { Button, Chip, IconButton, PlayIcon, PauseIcon, StepBackIcon, StepForwardIcon } from "@oocc/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlayerStore } from "@/lib/player";
import { type FixtureName, fetchFixture } from "@/lib/fixtures";
import { useEmbeddedTrace } from "@/lib/curriculum/useEmbeddedTrace";
import { MiniRibbon } from "./MiniRibbon";

function formatValue(value: Value | undefined): string {
  if (value === null || value === undefined) return "None";
  if ("val" in value) return value.repr ?? JSON.stringify(value.val);
  if ("ref" in value) return value.ref;
  return "";
}

export interface EmbeddedTraceProps {
  /** Which committed fixture (Python or C++) this block runs — the whole
   * point is that this is a REAL trace, not a static code sample, so it
   * always points at one of the already-generated fixtures/**.trace.json
   * files rather than embedding hand-authored "example output." */
  fixture: FixtureName;
  /** Optional caption shown above the code, e.g. "the partition step". */
  caption?: string;
}

/**
 * The thing neither LeetCode nor GeeksForGeeks has (docs/PRD.md §6.5): a
 * code block inside prose that is a real, scrubbable trace with its own
 * mini ribbon, rather than static text. Deliberately does NOT use the
 * page-wide `usePlayerStore` for its own playback (see
 * useEmbeddedTrace.ts) — only reaches into it once, on "Expand", to hand
 * the same trace to the full workspace and navigate there.
 */
export function EmbeddedTrace({ fixture, caption }: EmbeddedTraceProps) {
  const router = useRouter();
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchFixture>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFixture(fixture)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trace");
      });
    return () => {
      cancelled = true;
    };
  }, [fixture]);

  if (error) {
    return (
      <div className="border border-rule bg-panel px-3 py-2 font-mono-label text-[11px] text-mutate">
        Couldn&apos;t load embedded trace &ldquo;{fixture}&rdquo;: {error}
      </div>
    );
  }

  if (!bundle) {
    // docs/PRD.md §9: "no layout shift on trace load — skeleton panels
    // reserve their space." The loaded card is header (~32px) + changed-
    // locals row (~40px) + MiniRibbon row (~40px) + controls row (~32px)
    // + a code block that's capped at max-h-72 (288px, `overflow-auto`
    // beyond that) — every one of the twelve+ real fixtures embedded in
    // an article is long enough to hit that cap, so this fixed height
    // matches the loaded card almost exactly rather than guessing low.
    return (
      <div className="h-[27rem] animate-pulse border border-rule bg-panel" aria-label="Loading embedded trace" />
    );
  }

  return <EmbeddedTraceLoaded bundle={bundle} caption={caption} onExpand={() => {
    usePlayerStore.getState().loadTrace({
      trace: bundle.trace,
      source: bundle.source,
      name: bundle.name,
      plan: bundle.plan,
      analysis: bundle.analysis,
    });
    router.push("/");
  }} />;
}

function EmbeddedTraceLoaded({
  bundle,
  caption,
  onExpand,
}: {
  bundle: NonNullable<Awaited<ReturnType<typeof fetchFixture>>>;
  caption?: string | undefined;
  onExpand: () => void;
}) {
  const { trace, source } = bundle;
  const { currentStep, step, playing, channels, ticks, jumpTo, stepBy, togglePlay, lastIndex } =
    useEmbeddedTrace(trace);

  const lines = source.split("\n");
  const currentLine = step?.line ?? 0;
  const topFrame = step?.stack[step.stack.length - 1];

  const changedLocals = step
    ? step.changed
        .map((path) => /^f\d+\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(path)?.[1])
        .filter((name): name is string => Boolean(name) && Boolean(topFrame?.locals[name!]))
    : [];

  return (
    <div className="border border-rule bg-panel">
      <div className="flex items-center justify-between border-b border-rule px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            {caption ?? bundle.name}
          </span>
          <Chip tone="neutral">{trace.language}</Chip>
        </div>
        <Button variant="secondary" size="sm" onClick={onExpand}>
          Expand to workspace
        </Button>
      </div>

      <pre className="max-h-72 overflow-auto px-2 py-2 font-editor text-[13px] leading-[1.6]">
        {lines.map((line, i) => {
          const lineNumber = i + 1;
          const isCurrent = lineNumber === currentLine;
          return (
            <div
              key={lineNumber}
              className={isCurrent ? "bg-signal/10 -mx-2 px-2" : undefined}
              data-testid={isCurrent ? "embedded-trace-current-line" : undefined}
            >
              <span className="mr-3 inline-block w-6 select-none text-right text-ink-soft/60">{lineNumber}</span>
              <span className={isCurrent ? "text-ink" : "text-ink-soft"}>{line || " "}</span>
            </div>
          );
        })}
      </pre>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-rule px-2 py-1.5">
        {changedLocals.length > 0 ? (
          changedLocals.map((name) => (
            <Chip key={name} channel={(channels.get(name) ?? 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>
              {name} = {formatValue(topFrame?.locals[name])}
            </Chip>
          ))
        ) : (
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            no change this step
          </span>
        )}
      </div>

      <div className="border-t border-rule px-2 py-1.5">
        <MiniRibbon ticks={ticks} currentStep={currentStep} onScrub={jumpTo} />
      </div>

      <div className="flex items-center gap-1 border-t border-rule px-2 py-1">
        <IconButton aria-label="Step back" onClick={() => stepBy(-1)} disabled={currentStep === 0}>
          <StepBackIcon />
        </IconButton>
        <IconButton aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton aria-label="Step forward" onClick={() => stepBy(1)} disabled={currentStep === lastIndex}>
          <StepForwardIcon />
        </IconButton>
        <span className="ml-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          step {currentStep + 1}/{trace.steps.length} · line {currentLine}
        </span>
      </div>
    </div>
  );
}
