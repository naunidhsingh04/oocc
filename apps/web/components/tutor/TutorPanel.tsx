"use client";

import { usePlayerStore } from "@/lib/player";
import { useTutorStore } from "@/lib/tutor/store";
import { Button } from "@oocc/ui";
import { useEffect } from "react";
import { TutorTranscript } from "./TutorTranscript";

/**
 * The collapsed tutor's single input row (docs/PRD.md §6.4's own mockup:
 * `TUTOR ▸ why does mid keep landing on 4?`) — just enough to ask a
 * question without the full transcript/suggestions/chips chrome, which
 * only matters once there's a conversation to show. Submitting expands
 * the panel itself (`ask` flips `collapsed` to `false` — see
 * lib/tutor/store.ts), so this row's only job is capturing the question.
 */
function CollapsedComposer() {
  const composerText = useTutorStore((state) => state.composerText);
  const setComposerText = useTutorStore((state) => state.setComposerText);
  const streaming = useTutorStore((state) => state.streaming);
  const ask = useTutorStore((state) => state.ask);
  const capabilities = usePlayerStore((state) => state.capabilities);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void ask();
  }

  return (
    <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-1.5 border-t border-rule p-2">
      <input
        value={composerText}
        onChange={(event) => setComposerText(event.target.value)}
        placeholder={
          capabilities.tutor ? "Ask about this run…" : "Add a Gemini API key in settings to ask the tutor…"
        }
        className="h-8 min-w-0 flex-1 rounded-control border border-rule bg-panel px-2 font-body text-[13px] text-ink outline-none focus:border-signal"
      />
      <Button type="submit" variant="primary" size="sm" disabled={streaming || !composerText.trim()}>
        Ask
      </Button>
    </form>
  );
}

/**
 * Docked along the bottom edge, resizable, collapsible (docs/PRD.md §6.4,
 * Phase 3 frontend spec item 2). Deliberately not built from any chat-UI
 * vocabulary: no avatar, no assistant badge, no typing-dots, no rounded
 * bubbles. A flat, dense transcript — user turns get a signal-colored left
 * rule, assistant turns get none, both set in the same body type as the
 * rest of the app. This is what keeps it reading as an instrument panel
 * instead of a chatbot bolted on the side. The transcript/composer body
 * itself lives in `TutorTranscript`, reused as-is by the narrow single-
 * column workspace's own "Tutor" tab (docs/PRD.md §9), which needs no
 * second collapse/resize chrome around it.
 */
export function TutorPanel() {
  const collapsed = useTutorStore((state) => state.collapsed);
  const toggleCollapsed = useTutorStore((state) => state.toggleCollapsed);
  const streaming = useTutorStore((state) => state.streaming);
  const fixtureName = usePlayerStore((state) => state.fixtureName);

  useEffect(() => {
    useTutorStore.getState().clearForNewRun();
  }, [fixtureName]);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-rule bg-panel" data-tour="tutor">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex h-7 shrink-0 items-center justify-between border-b border-rule px-3"
        aria-expanded={!collapsed}
      >
        <span className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          Tutor {streaming ? "· thinking…" : ""}
        </span>
        <span aria-hidden className="font-mono-label text-[10px] text-ink-soft">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {collapsed ? (
        <CollapsedComposer />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <TutorTranscript />
        </div>
      )}
    </div>
  );
}
