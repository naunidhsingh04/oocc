"use client";

import { getStateAt, usePlayerStore } from "@/lib/player";
import { EMPTY_INSIGHTS } from "@/lib/insights/insightsView";
import { computeSuggestedQuestions } from "@/lib/tutor/suggestedQuestions";
import { useTutorStore } from "@/lib/tutor/store";
import { Button } from "@oocc/ui";
import { useMemo } from "react";

/**
 * The tutor's composer: suggested questions (regenerated from the current
 * step every time it changes, never hardcoded — spec item 2), the pending
 * editor-selection attach affordance, attached context chips, and the
 * input itself. No send icon-button-in-a-bubble; a flat row, consistent
 * with the rest of the instrument.
 */
export function Composer() {
  const step = usePlayerStore((state) => getStateAt(state.trace, state.currentStep));
  const algorithm = usePlayerStore((state) => state.algorithm);
  const insights = usePlayerStore((state) => state.analysis?.insights ?? EMPTY_INSIGHTS);
  const capabilities = usePlayerStore((state) => state.capabilities);

  const composerText = useTutorStore((state) => state.composerText);
  const setComposerText = useTutorStore((state) => state.setComposerText);
  const contextChips = useTutorStore((state) => state.contextChips);
  const removeContextChip = useTutorStore((state) => state.removeContextChip);
  const pendingSelection = useTutorStore((state) => state.pendingSelection);
  const attachPendingSelection = useTutorStore((state) => state.attachPendingSelection);
  const streaming = useTutorStore((state) => state.streaming);
  const ask = useTutorStore((state) => state.ask);

  const suggestions = useMemo(
    () => computeSuggestedQuestions({ step, algorithm, insights }),
    [step, algorithm, insights],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void ask();
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-rule p-2">
      {suggestions.length > 0 && !streaming ? (
        <div className="flex flex-wrap gap-1" data-testid="suggested-questions">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void ask(question)}
              className="rounded-control border border-rule px-1.5 py-0.5 font-mono-label text-[10px] text-ink-soft transition-colors hover:border-signal hover:text-signal"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      {pendingSelection ? (
        <button
          type="button"
          onClick={attachPendingSelection}
          className="self-start rounded-control border border-dashed border-signal px-1.5 py-0.5 font-mono-label text-[10px] uppercase tracking-[0.04em] text-signal"
        >
          + Attach {pendingSelection.label} as context
        </button>
      ) : null}

      {contextChips.length > 0 ? (
        <div className="flex flex-wrap gap-1" data-testid="context-chips">
          {contextChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-control border border-rule bg-paper px-1.5 py-0.5 font-mono-label text-[10px] text-ink-soft"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeContextChip(chip.id)}
                aria-label={`Remove ${chip.label} context`}
                className="text-ink-soft hover:text-mutate"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          value={composerText}
          onChange={(event) => setComposerText(event.target.value)}
          placeholder={
            capabilities.tutor
              ? "Ask about this run…"
              : "Add a Gemini API key in settings to ask the tutor…"
          }
          className="h-8 min-w-0 flex-1 rounded-control border border-rule bg-panel px-2 font-body text-[13px] text-ink outline-none focus:border-signal"
        />
        <Button type="submit" variant="primary" size="sm" disabled={streaming || !composerText.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}
