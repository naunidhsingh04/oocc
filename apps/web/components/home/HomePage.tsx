"use client";

import { Button, Skeleton, Stagger, StaggerItem } from "@oocc/ui";
import dynamic from "next/dynamic";
import Link from "next/link";

// Canvas ribbon + a fixture fetch — client-only, same reasoning as every
// other dynamic-loaded surface in this app (docs/PRD.md §6).
const HeroDemo = dynamic(() => import("./HeroDemo").then((mod) => mod.HeroDemo), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-2xl space-y-2 rounded-panel border border-rule bg-panel p-3 shadow-raised">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-7 w-full" />
    </div>
  ),
});

const SECTIONS = [
  {
    title: "One color per variable",
    body: "Every value gets its own color the moment it first appears, and keeps it everywhere — the editor gutter, the panels, the timeline. Follow one color, follow one value.",
  },
  {
    title: "Real bugs, explained",
    body: "An infinite loop, an O(n²) surprise, an off-by-one — OOCC finds the pattern in the trace itself and points at the exact step, not just the symptom.",
  },
  {
    title: "40 problems, 12 concepts",
    body: "Practice problems and short articles share the same live traces, so reading about quicksort and debugging your own quicksort are the same activity.",
  },
];

/**
 * `/` — the whole pitch in one screen (docs/PRD.md §6: "show someone what
 * this product does in five seconds"). This used to *be* the full
 * workspace (`LandingWorkspace`, now deleted) on the theory that "the
 * running workspace is the pitch" — in practice that meant a first-time
 * visitor landed on a dense, fully-chromed editor with a toolbar, five
 * panels, and a docked tutor, which is the opposite of five seconds. The
 * full workspace now lives at `/play`; this page is a headline, one real
 * (but local-state, see `HeroDemo.tsx`) running trace, one button, and at
 * most three short sections below the fold — nothing else competes for
 * attention.
 */
export function HomePage() {
  return (
    <Stagger className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col items-center px-6 pb-24 pt-20 text-center">
        <StaggerItem className="max-w-xl">
          <h1 className="text-balance font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-ink">
            See what your code actually does
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty font-body text-[16px] leading-relaxed text-ink-soft">
            OOCC traces a real program and lets you scrub through every step, like a video — so a loop, a
            recursive call, or a pointer stops being something you have to imagine.
          </p>
        </StaggerItem>

        <StaggerItem className="mt-12 flex w-full flex-col items-center">
          <HeroDemo />
        </StaggerItem>

        <StaggerItem className="mt-10">
          <Button asChild variant="primary" size="md" className="h-11 px-6 text-[15px]">
            <Link href="/play">Start writing code</Link>
          </Button>
        </StaggerItem>
      </div>

      <StaggerItem className="border-t border-rule">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 px-6 py-20 sm:grid-cols-3">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="font-body text-[15px] font-semibold text-ink">{section.title}</h2>
              <p className="mt-2 text-pretty font-body text-[13px] leading-relaxed text-ink-soft">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </StaggerItem>
    </Stagger>
  );
}
