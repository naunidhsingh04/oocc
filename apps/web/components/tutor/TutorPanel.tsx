"use client";

import { usePlayerStore } from "@/lib/player";
import { useTutorStore } from "@/lib/tutor/store";
import { useEffect, useRef } from "react";
import { TutorTranscript } from "./TutorTranscript";

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
  const height = useTutorStore((state) => state.height);
  const setHeight = useTutorStore((state) => state.setHeight);
  const streaming = useTutorStore((state) => state.streaming);
  const fixtureName = usePlayerStore((state) => state.fixtureName);

  const resizingRef = useRef(false);

  useEffect(() => {
    useTutorStore.getState().clearForNewRun();
  }, [fixtureName]);

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
    <div className="flex shrink-0 flex-col border-t border-rule bg-panel" data-tour="tutor">
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
          <TutorTranscript />
        </div>
      )}
    </div>
  );
}
