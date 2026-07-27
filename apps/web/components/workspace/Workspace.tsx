"use client";

import { ComplexityPanel } from "@/components/panels/ComplexityPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { NarrationStrip } from "@/components/narration/NarrationStrip";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
import { TutorPanel } from "@/components/tutor/TutorPanel";
import { usePlaybackClock, usePlayerStore } from "@/lib/player";
import { ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useDefaultLayout } from "react-resizable-panels";
import { PanelGrid } from "./PanelGrid";
import { PlaybackBar } from "./PlaybackBar";
import { Toolbar } from "./Toolbar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

/**
 * The workspace (docs/PRD.md §6.4): editor + the viz_planner-driven panel
 * grid in a persisted resizable split, the trace ribbon pinned to the
 * bottom, the tutor docked below that (Phase 3). Phase 2 replaced Phase
 * 1's single hardcoded ArrayPanel with `PanelGrid`; Phase 3 adds the AI
 * surfaces around it without touching that layout engine.
 */
export function Workspace() {
  usePlaybackClock();
  useKeyboardShortcuts();

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
    // useDefaultLayout's own default reads the bare `localStorage` global,
    // which doesn't exist during Next's server render pass — this is a
    // client component, but Next still does one SSR pass for the initial
    // HTML, so an explicit no-op stub is needed there.
    storage: typeof window === "undefined" ? { getItem: () => null, setItem: () => {} } : window.localStorage,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar />
      <div className="min-h-0 flex-1">
        <ResizableSplit
          id="oocc-workspace-main"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <ResizablePane id="editor" defaultSize="55" minSize="20">
            <CodeEditor className="h-full" />
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="panels" defaultSize="45" minSize="20">
            {hasComplexity || hasInsights ? (
              <ResizableSplit id="oocc-panels-extras" orientation="vertical">
                <ResizablePane id="panel-grid" defaultSize="60" minSize="30">
                  <PanelGrid plan={plan} storageKey={storageKey} />
                </ResizablePane>
                <ResizableHandle />
                <ResizablePane id="extras" defaultSize="40" minSize="15">
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
      </div>
      <PlaybackBar />
      <NarrationStrip />
      <TraceRibbon />
      <TutorPanel />
    </div>
  );
}
