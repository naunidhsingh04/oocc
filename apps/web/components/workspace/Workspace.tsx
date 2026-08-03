"use client";

import { ComplexityPanel } from "@/components/panels/ComplexityPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { NarrationStrip } from "@/components/narration/NarrationStrip";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
import { TutorPanel } from "@/components/tutor/TutorPanel";
import { useSessionPersistence, usePlaybackClock, usePlayerStore } from "@/lib/player";
import { useTutorStore } from "@/lib/tutor/store";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { ResizableHandle, ResizablePane, ResizableSplit, Stagger, StaggerItem } from "@oocc/ui";
import { useEffect, useRef } from "react";
import { useDefaultLayout, type PanelImperativeHandle } from "react-resizable-panels";
import { NarrowWorkspace } from "./NarrowWorkspace";
import { OnboardingTour } from "./OnboardingTour";
import { PanelGrid } from "./PanelGrid";
import { PlaybackBar } from "./PlaybackBar";
import { StepAnnouncer } from "./StepAnnouncer";
import { Toolbar } from "./Toolbar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

// The tutor's own collapse toggle (its header ▸/▾, or auto-expanding when
// `ask()` runs — see lib/tutor/store.ts) drives the pane imperatively via
// `panelRef` rather than fighting the drag-resizable pane for a second
// source of truth on "how tall is this." A plain, fixed expand target
// (not "whatever it was last") keeps this one-way and simple; the
// boundary itself stays fully draggable to any size in between regardless
// of collapsed state, per the resizing requirements below.
// Percentage *strings*, not numbers — react-resizable-panels interprets a
// bare number as pixels, not percent (found live: an early version of
// this passed raw numbers everywhere here and every pane came out sized
// in single-digit pixels).
const TUTOR_COLLAPSED_SIZE = "6";
const TUTOR_EXPANDED_SIZE = "22";

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
// `sessionStorage`, not `localStorage` — every persisted layout here is
// per-tab session state (docs/PRD.md's "fresh start every visit" session
// model), not a cross-visit preference. `useDefaultLayout`'s own default
// reads the bare `localStorage` global, which doesn't exist during Next's
// server render pass — client component or not, Next still does one SSR
// pass for the initial HTML, so an explicit no-op stub is needed there.
const SESSION_STORAGE_STUB = { getItem: () => null, setItem: () => {} };
function sessionLayoutStorage(): Storage | typeof SESSION_STORAGE_STUB {
  return typeof window === "undefined" ? SESSION_STORAGE_STUB : window.sessionStorage;
}

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

  const { defaultLayout: mainLayout, onLayoutChanged: onMainLayoutChanged } = useDefaultLayout({
    id: "oocc-workspace-main",
    panelIds: ["editor", "panels"],
    storage: sessionLayoutStorage(),
  });
  // The upper work area (editor+panels) vs. the ribbon vs. the tutor —
  // three independently draggable regions (docs/PRD.md §6.4's own mockup
  // stacks them in exactly this order) instead of the ribbon/tutor being
  // fixed-height chrome the editor/panels area could never claim room
  // back from.
  const { defaultLayout: verticalLayout, onLayoutChanged: onVerticalLayoutChanged } = useDefaultLayout({
    id: "oocc-workspace-vertical",
    panelIds: ["upper", "ribbon", "tutor"],
    storage: sessionLayoutStorage(),
  });

  const tutorCollapsed = useTutorStore((state) => state.collapsed);
  const tutorPaneRef = useRef<PanelImperativeHandle>(null);
  useEffect(() => {
    tutorPaneRef.current?.resize(tutorCollapsed ? TUTOR_COLLAPSED_SIZE : TUTOR_EXPANDED_SIZE);
  }, [tutorCollapsed]);

  if (isNarrow) return <NarrowWorkspace />;

  return (
    <Stagger className="flex min-h-0 flex-1 flex-col">
      <StaggerItem>
        <Toolbar />
      </StaggerItem>
      <StaggerItem className="min-h-0 flex-1">
        <ResizableSplit
          id="oocc-workspace-vertical"
          orientation="vertical"
          defaultLayout={verticalLayout}
          onLayoutChanged={onVerticalLayoutChanged}
        >
          <ResizablePane id="upper" defaultSize="70" minSize="30">
            <ResizableSplit
              id="oocc-workspace-main"
              defaultLayout={mainLayout}
              onLayoutChanged={onMainLayoutChanged}
            >
              <ResizablePane id="editor" defaultSize="50" minSize="20" data-tour="editor">
                <CodeEditor className="h-full" />
              </ResizablePane>
              <ResizableHandle />
              <ResizablePane id="panels" defaultSize="50" minSize="20" data-tour="panels">
                {hasComplexity || hasInsights ? (
                  <ResizableSplit id="oocc-panels-extras" orientation="vertical">
                    <ResizablePane id="panel-grid" defaultSize="72" minSize="40">
                      <PanelGrid plan={plan} storageKey={storageKey} />
                    </ResizablePane>
                    <ResizableHandle orientation="vertical" />
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
          </ResizablePane>
          <ResizableHandle orientation="vertical" />
          <ResizablePane id="ribbon" defaultSize="12" minSize="6" maxSize="30">
            <div className="flex h-full min-h-0 flex-col">
              <PlaybackBar />
              <NarrationStrip />
              <TraceRibbon />
            </div>
          </ResizablePane>
          <ResizableHandle orientation="vertical" />
          <ResizablePane id="tutor" defaultSize={TUTOR_COLLAPSED_SIZE} minSize="5" panelRef={tutorPaneRef}>
            <TutorPanel />
          </ResizablePane>
        </ResizableSplit>
      </StaggerItem>
      <StepAnnouncer />
      <OnboardingTour />
    </Stagger>
  );
}
