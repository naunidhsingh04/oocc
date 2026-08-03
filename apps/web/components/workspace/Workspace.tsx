"use client";

import { ComplexityPanel } from "@/components/panels/ComplexityPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { NarrationStrip } from "@/components/narration/NarrationStrip";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
import { TutorPanel } from "@/components/tutor/TutorPanel";
import { useSessionPersistence, usePlaybackClock, usePlayerStore } from "@/lib/player";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { ResizableHandle, ResizablePane, ResizableSplit, Stagger, StaggerItem } from "@oocc/ui";
import { useDefaultLayout } from "react-resizable-panels";
import { NarrowWorkspace } from "./NarrowWorkspace";
import { OnboardingTour } from "./OnboardingTour";
import { PanelGrid } from "./PanelGrid";
import { PlaybackBar } from "./PlaybackBar";
import { StepAnnouncer } from "./StepAnnouncer";
import { Toolbar } from "./Toolbar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

/**
 * The workspace (docs/PRD.md §6.4): editor + the viz_planner-driven panel
 * grid in a persisted resizable split, the trace ribbon pinned to the
 * bottom, the tutor docked below that (Phase 3). Phase 2 replaced Phase
 * 1's single hardcoded ArrayPanel with `PanelGrid`; Phase 3 adds the AI
 * surfaces around it without touching that layout engine. Below the `md`
 * breakpoint this delegates entirely to `NarrowWorkspace` (docs/PRD.md
 * §9's "down to 375px" tabbed single column) — both hooks below are owned
 * here, not duplicated in `NarrowWorkspace`, so the playback clock and
 * global keyboard shortcuts only ever run once regardless of which layout
 * renders.
 */
export function Workspace() {
  usePlaybackClock();
  useKeyboardShortcuts();
  useSessionPersistence();
  const isNarrow = useMediaQuery("(max-width: 767px)");

  const plan = usePlayerStore((state) => state.plan);
  const analysis = usePlayerStore((state) => state.analysis);
  const fixtureName = usePlayerStore((state) => state.fixtureName);
  const trace = usePlayerStore((state) => state.trace);
  const storageKey = fixtureName ?? trace?.source_hash ?? "none";
  const hasComplexity = !!analysis?.complexity;
  const hasInsights = (analysis?.insights.length ?? 0) > 0;

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "oocc-workspace-main",
    panelIds: ["editor", "panels"],
    // `sessionStorage`, not `localStorage` — this layout is per-tab
    // session state (docs/PRD.md's "fresh start every visit" session
    // model), not a cross-visit preference. `useDefaultLayout`'s own
    // default reads the bare `localStorage` global, which doesn't exist
    // during Next's server render pass — this is a client component, but
    // Next still does one SSR pass for the initial HTML, so an explicit
    // no-op stub is needed there either way.
    storage: typeof window === "undefined" ? { getItem: () => null, setItem: () => {} } : window.sessionStorage,
  });

  if (isNarrow) return <NarrowWorkspace />;

  return (
    <Stagger className="flex min-h-0 flex-1 flex-col">
      <StaggerItem>
        <Toolbar />
      </StaggerItem>
      <StaggerItem className="min-h-0 flex-1">
        <ResizableSplit
          id="oocc-workspace-main"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePane id="editor" defaultSize="55" minSize="20" data-tour="editor">
            <CodeEditor className="h-full" />
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="panels" defaultSize="45" minSize="20" data-tour="panels">
            {hasComplexity || hasInsights ? (
              <ResizableSplit id="oocc-panels-extras" orientation="vertical">
                <ResizablePane id="panel-grid" defaultSize="72" minSize="40">
                  <PanelGrid plan={plan} storageKey={storageKey} />
                </ResizablePane>
                <ResizableHandle />
                <ResizablePane id="extras" defaultSize="28" minSize="15">
                  {hasComplexity && hasInsights ? (
                    <ResizableSplit id="oocc-complexity-insights" orientation="horizontal">
                      <ResizablePane id="complexity" defaultSize="50" minSize="20">
                        <ComplexityPanel />
                      </ResizablePane>
                      <ResizableHandle />
                      <ResizablePane id="insights" defaultSize="50" minSize="20">
                        <InsightsPanel />
                      </ResizablePane>
                    </ResizableSplit>
                  ) : hasComplexity ? (
                    <ComplexityPanel />
                  ) : (
                    <InsightsPanel />
                  )}
                </ResizablePane>
              </ResizableSplit>
            ) : (
              <PanelGrid plan={plan} storageKey={storageKey} />
            )}
          </ResizablePane>
        </ResizableSplit>
      </StaggerItem>
      <PlaybackBar />
      <NarrationStrip />
      <TraceRibbon />
      <TutorPanel />
      <StepAnnouncer />
      <OnboardingTour />
    </Stagger>
  );
}
