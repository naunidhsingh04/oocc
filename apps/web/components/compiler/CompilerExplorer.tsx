"use client";

import { Button, ErrorBoundary, Panel, ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useCompilerPlayback } from "@/lib/compiler/usePlayback";
import { usePipeline } from "@/lib/compiler/usePipeline";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { VmStep } from "@/lib/compiler/types";
import { CompilerRightPane } from "./CompilerRightPane";
import { PipelineStrip } from "./PipelineStrip";
import { SourcePane } from "./SourcePane";

const EXAMPLE_SOURCE = `let x = 1 + 2 * 3;
print x;
`;

// A stable reference, not `?? []` inline — a fresh array literal on every
// render (while `result` is null/traceless) changes `usePlayback`'s `steps`
// identity every render, which it treats as new data to clamp against, an
// infinite render loop (same class of bug `lib/insights/insightsView.ts`'s
// `EMPTY_INSIGHTS` fixes for the Zustand selector case).
const EMPTY_VM_STEPS: readonly VmStep[] = [];

/**
 * /compiler (docs/PRD.md §7) — two panes: the source editor (always
 * visible, left half) and a single tabbed pane (Tokens/AST/Bytecode/Run,
 * `CompilerRightPane`) on the right, all cross-highlighted through
 * `lib/compiler/highlightStore.ts`'s shared astId. Recompiles on a 200ms
 * debounce via a lazily-created Worker (`lib/compiler/client.ts`)
 * wrapping Person B's WASM module.
 */
export function CompilerExplorer() {
  const pipeline = usePipeline(EXAMPLE_SOURCE);
  const vmSteps = pipeline.result?.trace ?? EMPTY_VM_STEPS;
  const playback = useCompilerPlayback(vmSteps);
  const isEmpty = pipeline.source.trim() === "";
  // Below `md`, the same two 50%-width columns this splits into on desktop
  // each end up too narrow for their own content — the Tokens table's line
  // numbers ran off the right edge and the Bytecode/Run tabs were pushed
  // fully out of view with no way to reach them (found live at 375px).
  // "One pane at a time" (docs/PRD.md §9) instead: source on top, full
  // width, the tabbed pane below it, also full width.
  const isNarrow = useMediaQuery("(max-width: 767px)");

  const sourcePane = (
    <Panel title="Source" className="relative h-full" bodyClassName="min-h-0">
      <ErrorBoundary title="Source">
        <SourcePane
          source={pipeline.source}
          onChange={pipeline.setSource}
          ast={pipeline.result?.ast ?? null}
          astIndex={pipeline.astIndex}
          error={pipeline.result?.error}
          className="h-full"
        />
      </ErrorBoundary>
      {isEmpty ? (
        <div className="absolute inset-x-0 bottom-0 top-10 flex items-center justify-center bg-panel p-6">
          <div className="max-w-sm text-center">
            <p className="mb-1 font-body text-[15px] font-semibold text-ink">
              This page compiles a small language live as you type
            </p>
            <p className="mb-4 font-body text-[13px] text-ink-soft">
              Watch source turn into tokens, an AST, bytecode, and a running stack VM — every pane
              cross-highlights the same piece of code.
            </p>
            <Button variant="primary" size="sm" onClick={() => pipeline.setSource(EXAMPLE_SOURCE)}>
              Load an example
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );

  const rightPane = (
    <CompilerRightPane
      tokens={pipeline.result?.tokens ?? []}
      ast={pipeline.result?.ast ?? null}
      bytecode={pipeline.result?.bytecode ?? null}
      vmSteps={vmSteps}
      vmTicks={pipeline.vmTicks}
      playback={playback}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PipelineStrip
        timings={pipeline.timings}
        failedStage={pipeline.result?.error?.stage ?? null}
        compiling={pipeline.compiling}
        loadStage={pipeline.loadStage}
      />
      {isNarrow ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="h-[45vh] shrink-0">{sourcePane}</div>
          <div className="min-h-[420px] shrink-0">{rightPane}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 p-3">
          <ResizableSplit id="compiler-explorer-main" orientation="horizontal">
            <ResizablePane id="compiler-source" defaultSize="50" minSize="30">
              {sourcePane}
            </ResizablePane>
            <ResizableHandle />
            <ResizablePane id="compiler-right" defaultSize="50" minSize="30">
              {rightPane}
            </ResizablePane>
          </ResizableSplit>
        </div>
      )}
    </div>
  );
}
