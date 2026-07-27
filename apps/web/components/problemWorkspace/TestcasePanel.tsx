import type { TestCase } from "@/lib/problems/types";

export function TestcasePanel({ testCases }: { testCases: TestCase[] }) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {testCases.map((tc, i) => (
        <div key={i} className="border border-rule bg-panel">
          <div className="border-b border-rule bg-paper px-2 py-1 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            Case {i + 1}
          </div>
          <div className="grid grid-cols-2 gap-px bg-rule">
            <div className="bg-panel p-2">
              <div className="mb-1 font-mono-label text-[10px] uppercase tracking-[0.06em] text-ink-soft">
                Input
              </div>
              <pre className="whitespace-pre-wrap font-editor text-[12px] leading-[1.5] text-ink">
                {tc.input || "(none)"}
              </pre>
            </div>
            <div className="bg-panel p-2">
              <div className="mb-1 font-mono-label text-[10px] uppercase tracking-[0.06em] text-ink-soft">
                Expected output
              </div>
              <pre className="whitespace-pre-wrap font-editor text-[12px] leading-[1.5] text-ink">
                {tc.expectedOutput}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
