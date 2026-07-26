"use client";

import { ComplexityPanel } from "@/components/panels/ComplexityPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
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
 * bottom. Phase 2 replaces Phase 1's single hardcoded ArrayPanel with
 * `PanelGrid`, the layout engine that mounts panels from a plan.
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
            {hasComplexity ? (
              <ResizableSplit id="oocc-panels-complexity" orientation="vertical">
                <ResizablePane id="panel-grid" defaultSize="70" minSize="30">
                  <PanelGrid plan={plan} storageKey={storageKey} />
                </ResizablePane>
                <ResizableHandle />
                <ResizablePane id="complexity" defaultSize="30" minSize="15">
                  <ComplexityPanel />
                </ResizablePane>
              </ResizableSplit>
            ) : (
              <PanelGrid plan={plan} storageKey={storageKey} />
            )}
          </ResizablePane>
        </ResizableSplit>
      </div>
      <PlaybackBar />
      <TraceRibbon />
    </div>
  );
}
