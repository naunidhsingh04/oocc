"use client";

import { ErrorBoundary, ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useDefaultLayout } from "react-resizable-panels";
import type { FixtureBundle, FixtureName } from "@/lib/fixtures";
import { useComparePlayback } from "@/lib/compare/useComparePlayback";
import { CompareControls } from "./CompareControls";
import { CompareRunPanel } from "./CompareRunPanel";
import { useCompareKeyboardShortcuts } from "./useCompareKeyboardShortcuts";

export interface CompareWorkspaceProps {
  bundleA: FixtureBundle;
  bundleB: FixtureBundle;
  loadingA: boolean;
  loadingB: boolean;
  onFixtureChangeA: (name: FixtureName) => void;
  onFixtureChangeB: (name: FixtureName) => void;
}

/**
 * Two runs, two editors, one synchronized scrubber (docs/PRD.md §7's
 * "compare-two-runs" Phase 5 deliverable) — the panel-chrome language is
 * PanelFrame/PanelGrid's "rack-mounted instrument" (shared hairline, no
 * floating cards), just two panes instead of a grid, since there's exactly
 * one binding (the source/trace) per side rather than a viz_plan.
 */
export function CompareWorkspace({
  bundleA,
  bundleB,
  loadingA,
  loadingB,
  onFixtureChangeA,
  onFixtureChangeB,
}: CompareWorkspaceProps) {
  const {
    sideA,
    sideB,
    posA,
    posB,
    playing,
    speed,
    syncMode,
    eventKind,
    setSyncMode,
    setEventKind,
    scrubA,
    scrubB,
    togglePlay,
    stepBy,
    cycleSpeed,
  } = useComparePlayback(bundleA.trace, bundleB.trace);

  useCompareKeyboardShortcuts({
    stepBy,
    togglePlay,
    cycleSpeed,
    scrubA,
    lastIndexA: sideA.lastIndex,
  });

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "oocc-compare-main",
    panelIds: ["run-a", "run-b"],
    storage: typeof window === "undefined" ? { getItem: () => null, setItem: () => {} } : window.localStorage,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ResizableSplit id="oocc-compare-main" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          <ResizablePane id="run-a" defaultSize="50" minSize="25">
            <ErrorBoundary title="Run A">
              <CompareRunPanel
                id="compare-fixture-a"
                label={`Run A · ${bundleA.name}`}
                source={bundleA.source}
                fixtureName={bundleA.name}
                onFixtureChange={onFixtureChangeA}
                loading={loadingA}
                side={sideA}
                pos={posA}
                onScrub={scrubA}
              />
            </ErrorBoundary>
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="run-b" defaultSize="50" minSize="25">
            <ErrorBoundary title="Run B">
              <CompareRunPanel
                id="compare-fixture-b"
                label={`Run B · ${bundleB.name}`}
                source={bundleB.source}
                fixtureName={bundleB.name}
                onFixtureChange={onFixtureChangeB}
                loading={loadingB}
                side={sideB}
                pos={posB}
                onScrub={scrubB}
              />
            </ErrorBoundary>
          </ResizablePane>
        </ResizableSplit>
      </div>
      <CompareControls
        playing={playing}
        speed={speed}
        syncMode={syncMode}
        eventKind={eventKind}
        onSetSyncMode={setSyncMode}
        onSetEventKind={setEventKind}
        onTogglePlay={togglePlay}
        onStepBy={stepBy}
        onJumpToStart={() => scrubA(0)}
        onJumpToEnd={() => scrubA(sideA.lastIndex)}
        onCycleSpeed={cycleSpeed}
      />
    </div>
  );
}
