"use client";

import { usePlayerStore } from "@/lib/player";
import { useTutorStore } from "@/lib/tutor/store";
import { useEffect, useRef } from "react";
import { Composer } from "./Composer";
import { MessageContent } from "./MessageContent";
import { StepChip } from "./StepChip";

/**
 * Docked along the bottom edge, resizable, collapsible (docs/PRD.md §6.4,
 * Phase 3 frontend spec item 2). Deliberately not built from any chat-UI
 * vocabulary: no avatar, no assistant badge, no typing-dots, no rounded
 * bubbles. A flat, dense transcript — user turns get a signal-colored left
 * rule, assistant turns get none, both set in the same body type as the
 * rest of the app. This is what keeps it reading as an instrument panel
 * instead of a chatbot bolted on the side.
 */
export function TutorPanel() {
  const collapsed = useTutorStore((state) => state.collapsed);
  const toggleCollapsed = useTutorStore((state) => state.toggleCollapsed);
  const height = useTutorStore((state) => state.height);
  const setHeight = useTutorStore((state) => state.setHeight);
  const messages = useTutorStore((state) => state.messages);
  const streaming = useTutorStore((state) => state.streaming);
  const channels = usePlayerStore((state) => state.channels);
  const fixtureName = usePlayerStore((state) => state.fixtureName);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    useTutorStore.getState().clearForNewRun();
  }, [fixtureName]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function startResize(event: React.PointerEvent) {
    event.preventDefault();
    resizingRef.current = true;
    const startY = event.clientY;
    const startHeight = height;

    function onMove(moveEvent: PointerEvent) {
      if (!resizingRef.current) return;
      setHeight(startHeight - (moveEvent.clientY - startY));
    }
    function onUp() {
      resizingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-rule bg-panel">
      <div
        onPointerDown={collapsed ? undefined : startResize}
        className={collapsed ? "" : "h-1 w-full cursor-row-resize hover:bg-signal"}
        data-testid="tutor-resize-handle"
      />
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

      {collapsed ? null : (
        <div className="flex min-h-0 flex-col" style={{ height }}>
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
      )}
    </div>
  );
}
