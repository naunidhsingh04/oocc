"use client";

import { ComplexityPanel } from "@/components/panels/ComplexityPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { NarrationStrip } from "@/components/narration/NarrationStrip";
import { TraceRibbon } from "@/components/ribbon/TraceRibbon";
import { TutorTranscript } from "@/components/tutor/TutorTranscript";
import { usePlayerStore } from "@/lib/player";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@oocc/ui";
import { PanelGrid } from "./PanelGrid";
import { PlaybackBar } from "./PlaybackBar";
import { StepAnnouncer } from "./StepAnnouncer";
import { Toolbar } from "./Toolbar";

/**
 * docs/PRD.md §9: "Down to 375px the workspace collapses to a tabbed
 * single column of code, visual and tutor, with the ribbon pinned." A
 * separate component rather than a CSS-only reflow of `Workspace` — the
 * desktop layout is a `ResizableSplit` (editor | panel grid) with the
 * tutor as an independently resizable docked drawer; none of those three
 * pieces of chrome make sense stacked in a phone-width column, so the
 * narrow layout is genuinely a different arrangement of the same
 * lower-level pieces (`CodeEditor`, `PanelGrid`, `ComplexityPanel`,
 * `InsightsPanel`, `TutorTranscript`), not a resize of the same one.
 * `TraceRibbon`/`PlaybackBar`/`NarrationStrip` stay pinned below the tabs
 * regardless of which tab is active — switching tabs never loses scrub
 * position or playback controls. Read-only viewing (scrubbing, watching
 * panels update, reading tutor answers) is fully supported; editing is
 * possible (the Code tab is a real CodeEditor) but not specially
 * optimized for touch, per the phase brief's own "editing needs only to
 * be possible" bar.
 */
export function NarrowWorkspace() {
  const plan = usePlayerStore((state) => state.plan);
  const analysis = usePlayerStore((state) => state.analysis);
  const fixtureName = usePlayerStore((state) => state.fixtureName);
  const trace = usePlayerStore((state) => state.trace);
  const storageKey = fixtureName ?? trace?.source_hash ?? "none";
  const hasComplexity = !!analysis?.complexity;
  const hasInsights = (analysis?.insights.length ?? 0) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar />
      <Tabs defaultValue="code" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 justify-center px-2">
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="tutor">Tutor</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="flex min-h-0 flex-1 flex-col p-0">
          <CodeEditor className="h-full" />
        </TabsContent>
        <TabsContent value="visual" className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-2">
          {/* A fixed, generous min-height rather than flex-1: PanelGrid's
              vertical PanelStack needs a definite ancestor height to
              resolve each stacked panel's percentage size against (same
              rule Phase 1's own "full-height layout gotcha" established),
              and four-plus stacked panels genuinely need more than one
              screen's worth of height to each show real content — this
              whole tab already scrolls, so a tall, fixed box here reads
              as "keep scrolling," not a layout bug. */}
          <div className="min-h-[640px] shrink-0">
            <PanelGrid plan={plan} storageKey={storageKey} forceStacked />
          </div>
          {hasComplexity ? <ComplexityPanel /> : null}
          {hasInsights ? <InsightsPanel /> : null}
        </TabsContent>
        <TabsContent value="tutor" className="flex min-h-0 flex-1 flex-col p-0">
          <TutorTranscript />
        </TabsContent>
      </Tabs>
      <PlaybackBar />
      <NarrationStrip />
      <TraceRibbon />
      <StepAnnouncer />
    </div>
  );
}
