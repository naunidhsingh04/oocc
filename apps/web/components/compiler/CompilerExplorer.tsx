"use client";

import { Panel, ResizableHandle, ResizablePane, ResizableSplit } from "@oocc/ui";
import { useCompilerPlayback } from "@/lib/compiler/usePlayback";
import { usePipeline } from "@/lib/compiler/usePipeline";
import type { VmStep } from "@/lib/compiler/types";
import { AstPane } from "./AstPane";
import { BytecodePane } from "./BytecodePane";
import { PipelineStrip } from "./PipelineStrip";
import { SourcePane } from "./SourcePane";
import { TokensPane } from "./TokensPane";
import { VmPane } from "./VmPane";

const INITIAL_SOURCE = `let x = 1 + 2 * 3;
print x;
`;

// A stable reference, not `?? []` inline — a fresh array literal on every
// render (while `result` is null/traceless) changes `usePlayback`'s `steps`
// identity every render, which it treats as new data to clamp against, an
// infinite render loop (same class of bug `lib/insights/insightsView.ts`'s
// `EMPTY_INSIGHTS` fixes for the Zustand selector case).
const EMPTY_VM_STEPS: readonly VmStep[] = [];

/**
 * /compiler (docs/PRD.md §7) — source, tokens, AST, bytecode, and the VM,
 * all cross-highlighted through `lib/compiler/highlightStore.ts`'s shared
 * astId. Recompiles on a 200ms debounce via a lazily-created Worker
 * (`lib/compiler/client.ts`) wrapping Person B's WASM module.
 */
export function CompilerExplorer() {
  const pipeline = usePipeline(INITIAL_SOURCE);
  const vmSteps = pipeline.result?.trace ?? EMPTY_VM_STEPS;
  const playback = useCompilerPlayback(vmSteps);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PipelineStrip
        timings={pipeline.timings}
        failedStage={pipeline.result?.error?.stage ?? null}
        compiling={pipeline.compiling}
      />
      <div className="min-h-0 flex-1">
        <ResizableSplit id="compiler-explorer-main" orientation="horizontal">
          <ResizablePane id="compiler-source" defaultSize="30" minSize="15">
            <Panel title="Source" className="h-full" bodyClassName="min-h-0">
              <SourcePane
                source={pipeline.source}
                onChange={pipeline.setSource}
                ast={pipeline.result?.ast ?? null}
                astIndex={pipeline.astIndex}
                error={pipeline.result?.error}
                className="h-full"
              />
            </Panel>
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="compiler-tokens" defaultSize="18" minSize="10">
            <Panel title="Tokens" className="h-full" bodyClassName="min-h-0">
              <TokensPane tokens={pipeline.result?.tokens ?? []} ast={pipeline.result?.ast ?? null} />
            </Panel>
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="compiler-ast" defaultSize="22" minSize="12">
            <Panel title="AST" className="h-full" bodyClassName="min-h-0">
              <AstPane ast={pipeline.result?.ast ?? null} />
            </Panel>
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="compiler-bytecode" defaultSize="15" minSize="12">
            <Panel title="Bytecode" className="h-full" bodyClassName="min-h-0">
              <BytecodePane bytecode={pipeline.result?.bytecode ?? null} currentPc={playback.step?.pc} />
            </Panel>
          </ResizablePane>
          <ResizableHandle />
          <ResizablePane id="compiler-vm" defaultSize="15" minSize="15">
            <Panel title="VM" className="h-full" bodyClassName="min-h-0">
              <VmPane
                steps={vmSteps}
                ticks={pipeline.vmTicks}
                currentStep={playback.currentStep}
                step={playback.step}
                playing={playback.playing}
                lastIndex={playback.lastIndex}
                jumpTo={playback.jumpTo}
                stepBy={playback.stepBy}
                togglePlay={playback.togglePlay}
              />
            </Panel>
          </ResizablePane>
        </ResizableSplit>
      </div>
    </div>
  );
}
