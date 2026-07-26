import { usePlayerStore } from "@/lib/player";
import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * docs/PRD.md §6.3: arrows step, shift-arrows jump 10, space plays, `,`/`.`
 * change speed, Home/End jump to the ends. Global (not scoped to the
 * ribbon) so scrubbing works no matter what's focused, except real text
 * inputs — the stdin drawer and the dev fixture picker still need to
 * receive their own keystrokes.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const store = usePlayerStore.getState();
      if (!store.trace) return;

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) store.jumpBy(10);
          else store.stepForward();
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) store.jumpBy(-10);
          else store.stepBackward();
          break;
        case " ":
          event.preventDefault();
          store.togglePlay();
          break;
        case ",":
          store.cycleSpeed(-1);
          break;
        case ".":
          store.cycleSpeed(1);
          break;
        case "Home":
          event.preventDefault();
          store.jumpToStart();
          break;
        case "End":
          event.preventDefault();
          store.jumpToEnd();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
