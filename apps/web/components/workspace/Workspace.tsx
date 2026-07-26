"use client";

import { CodeEditor } from "@/components/editor/CodeEditor";
import { ArrayPanel } from "@/components/panels/ArrayPanel";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
import { usePlaybackClock } from "@/lib/player";
import { ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useDefaultLayout } from "react-resizable-panels";
import { PlaybackBar } from "./PlaybackBar";
import { Toolbar } from "./Toolbar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

/**
 * Phase 1's workspace (docs/PRD.md §6.4): editor + array panel in a
 * persisted resizable split, the trace ribbon pinned to the bottom, driven
 * entirely by fixtures — no backend in this phase.
 */
export function Workspace() {
  usePlaybackClock();
  useKeyboardShortcuts();

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
            <ArrayPanel />
          </ResizablePane>
        </ResizableSplit>
      </div>
      <PlaybackBar />
      <TraceRibbon />
    </div>
  );
}
