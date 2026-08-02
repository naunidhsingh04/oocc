"use client";

import { usePlayerStore } from "@/lib/player";
import { Button, Chip } from "@oocc/ui";
import { AlgorithmBadge } from "./AlgorithmBadge";
import { FixturePicker } from "./FixturePicker";
import { StdinDrawer } from "./StdinDrawer";

const STATUS_TONE = {
  ok: "ok",
  runtime_error: "mutate",
  timeout: "warn",
  step_limit: "warn",
  memory_limit: "warn",
  compile_error: "mutate",
} as const;

/** docs/PRD.md §6.4: the workspace toolbar — run control, stdin, fixture picker. */
export function Toolbar() {
  const fixtureName = usePlayerStore((state) => state.fixtureName);
  const status = usePlayerStore((state) => state.trace?.status);
  const hasTrace = usePlayerStore((state) => state.trace !== null);
  const language = usePlayerStore((state) => state.trace?.language);

  function handleRun() {
    const { jumpToStart, play } = usePlayerStore.getState();
    jumpToStart();
    play();
  }

  return (
    // `min-h-9` + `flex-wrap` (not a fixed `h-9`) — at narrow widths the
    // fixture picker's <select> plus the run button and status chips
    // don't fit one 36px row; a fixed height clipped the wrapped second
    // line under the tab bar below instead of showing it (found live at
    // 375px). Wrapping lets it grow to two rows there while staying a
    // single row everywhere it already fit.
    <div className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-rule bg-panel px-3 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleRun} disabled={!hasTrace}>
          Run ▸
        </Button>
        {fixtureName ? (
          <Chip tone="neutral">{fixtureName}</Chip>
        ) : (
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            No fixture loaded
          </span>
        )}
        {/* Quiet engine indicator (docs/PRD.md Phase 4 frontend brief:
            "the engine in use shown quietly in the status bar") — never
            louder than the fixture chip it sits beside. */}
        {language ? (
          <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">{language}</span>
        ) : null}
        {status && status !== "ok" ? <Chip tone={STATUS_TONE[status]}>{status}</Chip> : null}
        <AlgorithmBadge />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StdinDrawer />
        <FixturePicker />
      </div>
    </div>
  );
}
