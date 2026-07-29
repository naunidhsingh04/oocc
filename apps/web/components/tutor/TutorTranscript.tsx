"use client";

import { usePlayerStore } from "@/lib/player";
import { useTutorStore } from "@/lib/tutor/store";
import { useEffect, useRef } from "react";
import { Composer } from "./Composer";
import { MessageContent } from "./MessageContent";
import { StepChip } from "./StepChip";

/**
 * The transcript + composer body, extracted from `TutorPanel` so the same
 * markup can mount inside the desktop docked drawer (which wraps this in
 * its own collapse/resize chrome) and directly as a tab's content in the
 * narrow single-column workspace (docs/PRD.md §9), without a redundant
 * second "Tutor" header/collapse toggle in the latter case.
 */
export function TutorTranscript() {
  const messages = useTutorStore((state) => state.messages);
  const channels = usePlayerStore((state) => state.channels);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={transcriptRef} className="min-h-0 flex-1 overflow-auto p-2" data-testid="tutor-transcript">
        {messages.length === 0 ? (
          <p className="p-2 font-body text-[12px] text-ink-soft">
            Ask about a step, a variable, or why the code did what it just did.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`tutor-message-${message.role}`}
                className={
                  message.role === "user"
                    ? "border-l-2 border-signal py-0.5 pl-2"
                    : "border-l-2 border-transparent py-0.5 pl-2"
                }
              >
                <MessageContent text={message.content || (message.pending ? "…" : "")} channels={channels} />
                {message.stepRefs.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {message.stepRefs.map((stepRef) => (
                      <StepChip key={stepRef} stepRef={stepRef} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      <Composer />
    </div>
  );
}
