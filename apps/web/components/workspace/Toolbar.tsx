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
    <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-rule bg-panel px-3">
      <div className="flex items-center gap-2">
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
      <div className="flex items-center gap-2">
        <StdinDrawer />
        <FixturePicker />
      </div>
    </div>
  );
}
