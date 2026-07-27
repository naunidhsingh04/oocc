import { Button, Chip } from "@oocc/ui";

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface ResultPanelProps {
  results: TestCaseResult[];
  onVisualizeFailure: (result: TestCaseResult) => void;
}

/** Simple line-level diff — sufficient for the short, single-line-ish
 * stdout every fixture produces; a full LCS diff would be overkill for
 * output this size and adds a dependency for no real benefit here. */
function DiffLines({ expected, actual }: { expected: string; actual: string }) {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);
  const rows = Array.from({ length: maxLines }, (_, i) => ({
    expected: expectedLines[i],
    actual: actualLines[i],
    same: expectedLines[i] === actualLines[i],
  }));

  return (
    <div className="grid grid-cols-2 gap-px bg-rule font-editor text-[12px] leading-[1.6]">
      <div className="bg-panel p-2">
        <div className="mb-1 font-mono-label text-[10px] uppercase tracking-[0.06em] text-ink-soft">Expected</div>
        {rows.map((row, i) => (
          <div key={i} className={row.same ? "text-ink" : "bg-ok/10 text-ok"}>
            {row.expected ?? <span className="text-ink-soft">(missing)</span>}
          </div>
        ))}
      </div>
      <div className="bg-panel p-2">
        <div className="mb-1 font-mono-label text-[10px] uppercase tracking-[0.06em] text-ink-soft">Actual</div>
        {rows.map((row, i) => (
          <div key={i} className={row.same ? "text-ink" : "bg-mutate/10 text-mutate"}>
            {row.actual ?? <span className="text-ink-soft">(missing)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The bet this product makes (docs/PRD.md Phase 4 frontend brief): on a
 * failed test, one click loads that test's trace into Visualize, already
 * scrubbed to the step where behavior diverged, with the expected/actual
 * diff right there. This panel is that one click.
 */
export function ResultPanel({ results, onVisualizeFailure }: ResultPanelProps) {
  if (results.length === 0) {
    return (
      <div className="p-4 text-center font-body text-[13px] text-ink-soft">
        Run &ldquo;Submit&rdquo; to see results here.
      </div>
    );
  }

  const allPassed = results.every((r) => r.passed);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <Chip tone={allPassed ? "ok" : "mutate"}>
          {results.filter((r) => r.passed).length}/{results.length} passed
        </Chip>
      </div>
      {results.map((result, i) => (
        <div key={i} className="border border-rule bg-panel">
          <div className="flex items-center justify-between border-b border-rule bg-paper px-2 py-1">
            <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
              Case {i + 1}
            </span>
            <Chip tone={result.passed ? "ok" : "mutate"}>{result.passed ? "Passed" : "Failed"}</Chip>
          </div>
          {result.passed ? (
            <pre className="whitespace-pre-wrap p-2 font-editor text-[12px] leading-[1.6] text-ink">
              {result.actualOutput}
            </pre>
          ) : (
            <div>
              <DiffLines expected={result.expectedOutput} actual={result.actualOutput} />
              <div className="border-t border-rule px-2 py-1.5">
                <Button variant="primary" size="sm" onClick={() => onVisualizeFailure(result)}>
                  Visualize where it went wrong
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
