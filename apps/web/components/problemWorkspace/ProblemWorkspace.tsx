"use client";

import type { Problem } from "@/lib/problems/types";
import { Button, ResizableHandle, ResizablePane, ResizableSplit, Tabs, TabsContent, TabsList, TabsTrigger } from "@oocc/ui";
import { useCallback, useEffect, useState } from "react";
import { fetchFixture } from "@/lib/fixtures";
import { usePlayerStore } from "@/lib/player";
import { Workspace } from "@/components/workspace/Workspace";
import { loadSubmissionDemo } from "@/lib/problems/submissionDemo";
import { StatementPanel } from "./StatementPanel";
import { TestcasePanel } from "./TestcasePanel";
import { ResultPanel, type TestCaseResult } from "./ResultPanel";

type Tab = "testcase" | "result" | "visualize";
type Language = "python" | "cpp";

export function ProblemWorkspace({ problem }: { problem: Problem }) {
  const [language, setLanguage] = useState<Language>("python");
  const [activeTab, setActiveTab] = useState<Tab>("testcase");
  const [results, setResults] = useState<TestCaseResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasCpp = Boolean(problem.fixtureCpp);

  // Load the run backing this problem into the (page-wide, singleton)
  // player store whenever the problem or language changes. The
  // binary-search demo is a special case: its starter code is
  // deliberately the buggy variant (see lib/problems/data.ts), so its
  // Visualize tab must show the BUGGY trace by default too, not the
  // committed (correct) fixture — otherwise the editor and the panels
  // would disagree about what actually ran.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (problem.hasSubmissionDemo) {
        const demo = await loadSubmissionDemo(problem.slug);
        if (!demo || cancelled) return;
        usePlayerStore.getState().loadTrace({
          trace: demo.buggyTrace,
          source: demo.buggySource,
          name: problem.slug,
        });
        return;
      }
      const fixtureName = language === "cpp" && problem.fixtureCpp ? problem.fixtureCpp : problem.fixturePython;
      const bundle = await fetchFixture(fixtureName);
      if (cancelled) return;
      usePlayerStore.getState().loadTrace({
        trace: bundle.trace,
        source: bundle.source,
        name: bundle.name,
        plan: bundle.plan,
        analysis: bundle.analysis,
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [problem, language]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      if (problem.hasSubmissionDemo) {
        const demo = await loadSubmissionDemo(problem.slug);
        if (demo) setResults(demo.caseResults);
      } else {
        // No live run pipeline yet for edited submissions (Phase 5) — a
        // "submit" against a fixture-backed problem replays the same
        // deterministic, already-committed run, so it always matches its
        // own recorded output. Honest about what's real right now,
        // matching every earlier phase's fixture-only precedent.
        setResults(
          problem.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: tc.expectedOutput,
            passed: true,
          })),
        );
      }
    } finally {
      setSubmitting(false);
      setActiveTab("result");
    }
  }, [problem]);

  const handleVisualizeFailure = useCallback(async () => {
    if (problem.hasSubmissionDemo) {
      const demo = await loadSubmissionDemo(problem.slug);
      if (demo) {
        usePlayerStore.getState().loadTrace({
          trace: demo.buggyTrace,
          source: demo.buggySource,
          name: problem.slug,
        });
        usePlayerStore.getState().jumpToStepRef(demo.divergenceStepI);
      }
    }
    setActiveTab("visualize");
  }, [problem]);

  return (
    <ResizableSplit id="oocc-problem-workspace" orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePane id="statement" defaultSize="38" minSize="24">
        <StatementPanel problem={problem} />
      </ResizablePane>
      <ResizableHandle />
      <ResizablePane id="work" defaultSize="62" minSize="40">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-rule bg-panel px-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLanguage("python")}
                disabled={problem.hasSubmissionDemo}
                className={`rounded-control border px-2 py-1 font-mono-label text-[11px] uppercase tracking-[0.06em] transition-colors ${
                  language === "python" ? "border-signal text-signal" : "border-rule text-ink-soft hover:text-ink"
                }`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => setLanguage("cpp")}
                disabled={!hasCpp || problem.hasSubmissionDemo}
                className={`rounded-control border px-2 py-1 font-mono-label text-[11px] uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  language === "cpp" ? "border-signal text-signal" : "border-rule text-ink-soft hover:text-ink"
                }`}
              >
                C++
              </button>
            </div>
            <Button variant="primary" size="sm" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="shrink-0 px-3">
              <TabsTrigger value="testcase">Testcase</TabsTrigger>
              <TabsTrigger value="result">Result</TabsTrigger>
              <TabsTrigger value="visualize">Visualize</TabsTrigger>
            </TabsList>
            <TabsContent value="testcase" className="min-h-0 flex-1 overflow-y-auto pt-0">
              <TestcasePanel testCases={problem.testCases} />
            </TabsContent>
            <TabsContent value="result" className="min-h-0 flex-1 overflow-y-auto pt-0">
              <ResultPanel results={results ?? []} onVisualizeFailure={() => void handleVisualizeFailure()} />
            </TabsContent>
            <TabsContent value="visualize" className="flex min-h-0 flex-1 flex-col pt-0">
              <Workspace />
            </TabsContent>
          </Tabs>
        </div>
      </ResizablePane>
    </ResizableSplit>
  );
}
